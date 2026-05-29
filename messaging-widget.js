// ========== MESSAGING WIDGET — PRODUCTION (sans debug, dates intelligentes)
// Fallback REST + Realtime broadcast pour statut online & typing

(function() {
    'use strict';

    const DEBUG = false;
    function log(label, data) {
        if (!DEBUG) return;
        const prefix = '[WIDGET] ' + label;
        if (data !== undefined) console.log(prefix, data);
        else console.log(prefix);
    }

    function withTimeout(promise, ms = 8000, label = 'req') {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${label} timeout`)), ms);
        });
        return Promise.race([promise, timeoutPromise]);
    }

    function getStoredToken() {
        if (state.accessToken) return state.accessToken;
        try {
            const url = new URL(window.YOTEACHER_CONFIG.SUPABASE_URL);
            const projectRef = url.hostname.split('.')[0];
            const key = `sb-${projectRef}-auth-token`;
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.access_token) {
                    state.accessToken = parsed.access_token;
                    return parsed.access_token;
                }
            }
        } catch (e) {}
        return null;
    }

    async function restRpc(functionName, params) {
        const token = getStoredToken();
        if (!token) throw new Error('Pas de token');
        const res = await fetch(`${window.YOTEACHER_CONFIG.SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
            method: 'POST',
            headers: {
                'apikey': window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params || {})
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}`);
        }
        if (res.status === 204) return null;
        return await res.json();
    }

    async function restInsert(table, row) {
        const token = getStoredToken();
        if (!token) throw new Error('Pas de token');
        const res = await fetch(`${window.YOTEACHER_CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
                'apikey': window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(row)
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
    }

    let state = {
        isOpen: false, isAdmin: false, myId: null, teacherId: null,
        teacherName: null, activePartner: null, activePartnerName: null,
        messageCache: new Map(),
        conversations: [], notifyChannel: null, chatChannel: null,
        pendingMessages: new Set(), supabaseBlocked: false,
        accessToken: null, unreadTotal: 0,
        presenceChannel: null, currentPresencePartner: null,
        lastPartnerHeartbeat: 0, heartbeatTimer: null, onlineCheckTimer: null,
        isTyping: false
    };

    function escapeHtml(str) {
        return (str || '').replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]));
    }

    // ========== FORMATAGE DATE INTELLIGENT ==========
    function formatMessageDate(iso) {
        const d = new Date(iso);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        if (msgDay.getTime() === today.getTime()) {
            return time; // Aujourd'hui → 14:30
        }
        if (msgDay.getTime() === yesterday.getTime()) {
            return 'Hier ' + time; // Hier → Hier 14:30
        }
        // Cette semaine (même semaine calendaire)
        const dayDiff = Math.floor((today - msgDay) / (1000 * 60 * 60 * 24));
        if (dayDiff < 7 && d.getDay() <= now.getDay()) {
            const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' });
            return dayName.charAt(0).toUpperCase() + dayName.slice(1) + ' ' + time; // Lundi 14:30
        }
        // Plus vieux → 15/05/2026 14:30
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + time;
    }

    function formatDateShort(iso) {
        const d = new Date(iso), now = new Date();
        if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    // ========== AVATAR DES MESSAGES ==========
    function getInitialsFromName(name) {
        if (!name) return '';
        var parts = name.split(' ').filter(function(n) { return n.length > 0; });
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    }

    function getMessageAvatarHtml(isSent) {
        var isMe = isSent;
        var initials = '';
        var cssClass = '';

        if (isMe) {
            if (state.isAdmin) {
                cssClass = 'teacher';
                initials = getInitialsFromName(state.teacherName);
            } else {
                cssClass = 'student';
                initials = '';
            }
        } else {
            if (state.isAdmin) {
                cssClass = 'student';
                initials = getInitialsFromName(state.activePartnerName);
            } else {
                cssClass = 'teacher';
                initials = getInitialsFromName(state.teacherName);
            }
        }

        var display = initials || (isMe ? (state.isAdmin ? '👨‍🏫' : '👤') : (state.isAdmin ? '🎓' : '👨‍🏫'));
        return '<div class="messaging-widget-msg-avatar ' + cssClass + '">' + display + '</div>';
    }

    function setupPresence(partnerId) {
        if (!partnerId || !state.myId) return;
        if (state.presenceChannel && state.currentPresencePartner === partnerId) return;
        if (state.presenceChannel) { try { state.presenceChannel.unsubscribe(); } catch (e) {} state.presenceChannel = null; }
        state.currentPresencePartner = partnerId;
        state.lastPartnerHeartbeat = Date.now();
        const channelName = 'widget-presence-' + [state.myId, partnerId].sort().join('-');
        state.presenceChannel = window.supabase
            .channel(channelName)
            .on('broadcast', { event: 'heartbeat' }, (payload) => {
                const p = payload.payload;
                if (p && p.userId === partnerId) {
                    state.lastPartnerHeartbeat = Date.now();
                    updateOnlineStatus(true);
                }
            })
            .on('broadcast', { event: 'typing' }, (payload) => {
                const p = payload.payload;
                if (p && p.userId === partnerId) {
                    p.active ? showTypingIndicator() : hideTypingIndicator();
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED' && state.presenceChannel) {
                    state.presenceChannel.send({ type: 'broadcast', event: 'heartbeat', payload: { userId: state.myId, timestamp: Date.now() }}).catch(() => {});
                }
            });
        if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
        state.heartbeatTimer = setInterval(() => {
            if (state.presenceChannel) {
                state.presenceChannel.send({ type: 'broadcast', event: 'heartbeat', payload: { userId: state.myId, timestamp: Date.now() }}).catch(() => {});
            }
        }, 10000);
        if (state.onlineCheckTimer) clearInterval(state.onlineCheckTimer);
        state.onlineCheckTimer = setInterval(() => {
            updateOnlineStatus(Date.now() - state.lastPartnerHeartbeat < 20000);
        }, 5000);
    }

    function updateOnlineStatus(isOnline) {
        const dot = document.getElementById('msg-widget-status-dot');
        const text = document.getElementById('msg-widget-status-text');
        if (!dot || !text) return;
        if (isOnline) { dot.classList.remove('offline'); text.textContent = 'En ligne'; }
        else { dot.classList.add('offline'); text.textContent = 'Hors ligne'; }
    }

    function showTypingIndicator() {
        const el = document.getElementById('msg-widget-typing');
        if (!el) return;
        const name = state.isAdmin ? "L'étudiant" : "Le professeur";
        el.textContent = name + " est en train d'écrire…";
        el.style.display = 'flex';
    }

    function hideTypingIndicator() {
        const el = document.getElementById('msg-widget-typing');
        if (el) el.style.display = 'none';
    }

    function setupTypingListener(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        input.addEventListener('input', () => {
            const hasText = input.value.trim().length > 0;
            if (hasText && !state.isTyping) { state.isTyping = true; broadcastTyping(true); }
            else if (!hasText && state.isTyping) { state.isTyping = false; broadcastTyping(false); }
        });
        window.addEventListener('beforeunload', () => { if (state.isTyping) broadcastTyping(false); });
    }

    function broadcastTyping(active) {
        if (!state.presenceChannel) return;
        state.presenceChannel.send({ type: 'broadcast', event: 'typing', payload: { userId: state.myId, active: active }}).catch(() => {});
    }

    async function waitForSupabase() {
        const start = Date.now();
        while (Date.now() - start < 15000) {
            if (window.supabase && window.supabase.auth) {
                try {
                    const { data, error } = await window.supabase.auth.getUser();
                    if (!error && data?.user) return { client: window.supabase, user: data.user };
                } catch (e) {}
            }
            await new Promise(r => setTimeout(r, 200));
        }
        throw new Error('Supabase timeout');
    }

    async function detectRole(client, user) {
        state.myId = user.id;
        try {
            const { data: { session } } = await client.auth.getSession();
            if (session?.access_token) state.accessToken = session.access_token;
            if (!session?.access_token && !getStoredToken()) return false;
            const res = await fetch(window.YOTEACHER_CONFIG?.SUPABASE_URL + '/functions/v1/teacher-info', {
                headers: { Authorization: 'Bearer ' + (state.accessToken || getStoredToken()) }
            });
            if (!res.ok) return false;
            const teacher = await res.json();
            if (teacher.id === user.id) { state.isAdmin = true; state.teacherId = user.id; state.teacherName = teacher.full_name; }
            else { state.teacherId = teacher.id; state.teacherName = teacher.full_name; state.isAdmin = false; }
            return true;
        } catch (err) { return false; }
    }

    function createWidget() {
        if (document.getElementById('messaging-widget-root')) return;
        const root = document.createElement('div');
        root.id = 'messaging-widget-root';
        root.innerHTML = `
            <button id="msg-widget-bubble" class="messaging-widget-bubble" title="Messagerie">
                <i class="fas fa-comment-dots"></i>
            </button>
            <div id="msg-widget-window" class="messaging-widget-window" style="display:none;"></div>
        `;
        document.body.appendChild(root);
        document.getElementById('msg-widget-bubble').addEventListener('click', toggleWindow);
    }

    function toggleWindow() {
        const win = document.getElementById('msg-widget-window');
        if (!win) return;
        if (state.isOpen) {
            win.classList.add('closing');
            setTimeout(() => {
                win.style.display = 'none'; win.classList.remove('closing');
                state.isOpen = false; state.activePartner = null; state.activePartnerName = null; state.isTyping = false;
                if (state.chatChannel) { state.chatChannel.unsubscribe(); state.chatChannel = null; }
                if (state.presenceChannel) { state.presenceChannel.unsubscribe(); state.presenceChannel = null; }
                if (state.heartbeatTimer) { clearInterval(state.heartbeatTimer); state.heartbeatTimer = null; }
                if (state.onlineCheckTimer) { clearInterval(state.onlineCheckTimer); state.onlineCheckTimer = null; }
            }, 250);
        } else {
            state.isOpen = true; win.style.display = 'flex';
            state.isAdmin ? renderAdminConversations() : renderStudentChat();
        }
    }
    function closeWindow() { if (state.isOpen) toggleWindow(); }

    async function renderStudentChat() {
        const win = document.getElementById('msg-widget-window');
        if (!win || !state.teacherId) return;
        const cached = state.messageCache.get(state.teacherId);
        win.innerHTML = `
            <div class="messaging-widget-header">
                <div class="messaging-widget-header-info">
                    <div class="messaging-widget-avatar">👨‍🏫</div>
                    <div class="messaging-widget-header-text">
                        <div class="messaging-widget-header-name">${escapeHtml(state.teacherName || 'Professeur')}</div>
                        <div class="messaging-widget-header-status">
                            <span class="messaging-widget-status-dot" id="msg-widget-status-dot"></span>
                            <span id="msg-widget-status-text">En ligne</span>
                        </div>
                    </div>
                </div>
                <button class="messaging-widget-close" id="msg-widget-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="messaging-widget-messages" id="msg-widget-messages"></div>
            <div class="messaging-widget-typing" id="msg-widget-typing" style="display:none;"></div>
            <div class="messaging-widget-input-area">
                <input type="text" class="messaging-widget-input" id="msg-widget-input" placeholder="Écrivez un message..." autocomplete="off">
                <button class="messaging-widget-send" id="msg-widget-send"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        document.getElementById('msg-widget-close').addEventListener('click', closeWindow);
        document.getElementById('msg-widget-send').addEventListener('click', sendMessage);
        document.getElementById('msg-widget-input').addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
        const container = document.getElementById('msg-widget-messages');
        if (cached && cached.length > 0) renderMessagesToContainer(cached, container);
        else container.innerHTML = `<div class="messaging-widget-empty"><i class="fas fa-comment-slash"></i><p>Aucun message encore.<br>Commencez la conversation !</p></div>`;
        await loadMessages(state.teacherId);
        setupChatRealtime(state.teacherId);
        setupPresence(state.teacherId);
        setupTypingListener('msg-widget-input');
        updateOnlineStatus(Date.now() - state.lastPartnerHeartbeat < 20000);
    }

    async function renderAdminConversations() {
        const win = document.getElementById('msg-widget-window');
        if (!win) return;
        win.innerHTML = `
            <div class="messaging-widget-header">
                <div class="messaging-widget-header-info">
                    <div class="messaging-widget-avatar"><i class="fas fa-comments"></i></div>
                    <div class="messaging-widget-header-text">
                        <div class="messaging-widget-header-name">Messagerie</div>
                        <div class="messaging-widget-header-status">Conversations avec vos étudiants</div>
                    </div>
                </div>
                <button class="messaging-widget-close" id="msg-widget-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="messaging-widget-conversations" id="msg-widget-conversations">
                <div class="messaging-widget-empty"><i class="fas fa-spinner fa-spin"></i><p>Chargement...</p></div>
            </div>
        `;
        document.getElementById('msg-widget-close').addEventListener('click', closeWindow);
        await loadAdminConversations();
    }

    async function renderAdminChat(partnerId, partnerName) {
        const win = document.getElementById('msg-widget-window');
        if (!win) return;
        state.activePartner = partnerId;
        state.activePartnerName = partnerName;
        const cached = state.messageCache.get(partnerId);
        win.innerHTML = `
            <div class="messaging-widget-header">
                <button class="messaging-widget-back" id="msg-widget-back"><i class="fas fa-arrow-left"></i></button>
                <div class="messaging-widget-header-info">
                    <div class="messaging-widget-avatar">🎓</div>
                    <div class="messaging-widget-header-text">
                        <div class="messaging-widget-header-name">${escapeHtml(partnerName || 'Étudiant')}</div>
                        <div class="messaging-widget-header-status">
                            <span class="messaging-widget-status-dot" id="msg-widget-status-dot"></span>
                            <span id="msg-widget-status-text">En ligne</span>
                        </div>
                    </div>
                </div>
                <button class="messaging-widget-close" id="msg-widget-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="messaging-widget-messages" id="msg-widget-messages"></div>
            <div class="messaging-widget-typing" id="msg-widget-typing" style="display:none;"></div>
            <div class="messaging-widget-input-area">
                <input type="text" class="messaging-widget-input" id="msg-widget-input" placeholder="Répondez à votre étudiant..." autocomplete="off">
                <button class="messaging-widget-send" id="msg-widget-send"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        document.getElementById('msg-widget-back').addEventListener('click', () => {
            state.activePartner = null; state.activePartnerName = null; state.isTyping = false;
            if (state.chatChannel) { state.chatChannel.unsubscribe(); state.chatChannel = null; }
            renderAdminConversations();
        });
        document.getElementById('msg-widget-close').addEventListener('click', closeWindow);
        document.getElementById('msg-widget-send').addEventListener('click', sendMessage);
        document.getElementById('msg-widget-input').addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
        const container = document.getElementById('msg-widget-messages');
        if (cached && cached.length > 0) renderMessagesToContainer(cached, container);
        else container.innerHTML = `<div class="messaging-widget-empty"><i class="fas fa-comment-slash"></i><p>Aucun message encore.<br>Commencez la conversation !</p></div>`;
        await loadMessages(partnerId);
        setupChatRealtime(partnerId);
        setupPresence(partnerId);
        setupTypingListener('msg-widget-input');
        updateOnlineStatus(Date.now() - state.lastPartnerHeartbeat < 20000);
    }

    async function loadMessages(partnerId) {
        const container = document.getElementById('msg-widget-messages');
        if (!container) return;
        let msgs = null, error = null;
        if (!state.supabaseBlocked) {
            try {
                const result = await withTimeout(window.supabase.rpc('get_messages_with', { partner: partnerId }), 6000, 'rpc');
                msgs = result.data; error = result.error;
            } catch (err) { state.supabaseBlocked = true; }
        }
        if (!msgs && state.supabaseBlocked) {
            try { msgs = await restRpc('get_messages_with', { partner: partnerId }); error = null; }
            catch (err2) { error = err2; }
        }
        if (error) return;
        if (msgs) {
            state.messageCache.set(partnerId, msgs);
            renderMessagesToContainer(msgs, container);
            container.scrollTop = container.scrollHeight;
        }
        try {
            if (state.supabaseBlocked) restRpc('mark_messages_read', { partner: partnerId }).catch(() => {});
            else window.supabase.rpc('mark_messages_read', { partner: partnerId }).catch(() => {});
        } catch (e) {}
    }

    async function loadAdminConversations() {
        const container = document.getElementById('msg-widget-conversations');
        if (!container) return;
        let partners = null, error = null;
        if (!state.supabaseBlocked) {
            try {
                const result = await withTimeout(window.supabase.rpc('get_conversation_partners'), 6000, 'rpc');
                partners = result.data; error = result.error;
            } catch (err) { state.supabaseBlocked = true; }
        }
        if (!partners && state.supabaseBlocked) {
            try { partners = await restRpc('get_conversation_partners', {}); error = null; }
            catch (err2) { error = err2; }
        }
        if (error) { container.innerHTML = `<div class="messaging-widget-empty"><p>Erreur: ${escapeHtml(error.message)}</p></div>`; return; }
        state.conversations = partners || []; container.innerHTML = '';
        if (!partners || partners.length === 0) {
            container.innerHTML = `<div class="messaging-widget-empty"><i class="fas fa-inbox"></i><p>Aucune conversation pour le moment</p></div>`;
            return;
        }
        partners.forEach(p => {
            const div = document.createElement('div');
            div.className = 'messaging-widget-conv-item';
            if (p.partner_id === state.activePartner) div.classList.add('active');
            const initials = (p.partner_name || 'É').substring(0, 2).toUpperCase();
            const time = p.last_message_at ? formatDateShort(p.last_message_at) : '';
            const unread = p.unread_count > 0 ? `<span class="messaging-widget-conv-badge">${p.unread_count}</span>` : '';
            div.innerHTML = `
                <div class="messaging-widget-conv-avatar">${escapeHtml(initials)}</div>
                <div class="messaging-widget-conv-info">
                    <div class="messaging-widget-conv-name">${escapeHtml(p.partner_name || 'Étudiant')}</div>
                    <div class="messaging-widget-conv-preview">Cliquez pour ouvrir</div>
                </div>
                <div class="messaging-widget-conv-meta">
                    <span class="messaging-widget-conv-time">${time}</span>
                    ${unread}
                </div>
            `;
            div.addEventListener('click', () => renderAdminChat(p.partner_id, p.partner_name));
            container.appendChild(div);
        });
    }

    function renderMessagesToContainer(msgs, container) {
        if (!msgs || msgs.length === 0) {
            if (!container.querySelector('.messaging-widget-msg-row')) {
                container.innerHTML = `<div class="messaging-widget-empty"><i class="fas fa-comment-slash"></i><p>Aucun message encore.<br>Commencez la conversation !</p></div>`;
            }
            return;
        }
        container.innerHTML = '';
        msgs.forEach(m => appendMessage(m, container));
    }

    function appendMessage(msg, container) {
        const existing = container.querySelector(`[data-msg-id="${msg.id}"]`);
        if (existing) return;
        const isMe = msg.sender_id === state.myId;

        const row = document.createElement('div');
        row.className = `messaging-widget-msg-row ${isMe ? 'sent' : 'received'}`;

        const avatarWrapper = document.createElement('div');
        avatarWrapper.innerHTML = getMessageAvatarHtml(isMe);
        const avatarDiv = avatarWrapper.firstChild;

        const bubble = document.createElement('div');
        bubble.className = `messaging-widget-msg ${isMe ? 'sent' : 'received'}`;
        bubble.setAttribute('data-msg-id', msg.id || 'pending-' + Date.now());
        bubble.innerHTML = `${escapeHtml(msg.content)}<span class="messaging-widget-msg-time">${formatMessageDate(msg.created_at)}</span>`;

        row.appendChild(avatarDiv);
        row.appendChild(bubble);
        container.appendChild(row);
        container.scrollTop = container.scrollHeight;
    }

    async function sendMessage() {
        const input = document.getElementById('msg-widget-input');
        const content = input?.value.trim();
        if (!content) return;
        state.isTyping = false;
        broadcastTyping(false);
        const receiverId = state.isAdmin ? state.activePartner : state.teacherId;
        if (!receiverId) return;
        if (input) input.value = '';
        const tempId = 'pending-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        state.pendingMessages.add(tempId);
        const container = document.getElementById('msg-widget-messages');
        if (container) {
            if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
            appendMessage({ id: tempId, sender_id: state.myId, receiver_id: receiverId, content, created_at: new Date().toISOString() }, container);
        }
        let data = null, error = null;
        if (!state.supabaseBlocked) {
            try {
                const result = await withTimeout(window.supabase.from('messages').insert({ sender_id: state.myId, receiver_id: receiverId, content }).select(), 6000, 'insert');
                data = result.data; error = result.error;
            } catch (err) { state.supabaseBlocked = true; }
        }
        if (!data && state.supabaseBlocked) {
            try { data = await restInsert('messages', { sender_id: state.myId, receiver_id: receiverId, content }); error = null; }
            catch (err2) { error = err2; }
        }
        if (error) {
            const pendingEl = document.querySelector(`[data-msg-id="${tempId}"]`);
            if (pendingEl) pendingEl.remove();
            if (input) input.value = content;
            alert("Erreur d'envoi : " + error.message);
            state.pendingMessages.delete(tempId);
            return;
        }
        const realMsg = data?.[0];
        if (realMsg) {
            const pendingEl = document.querySelector(`[data-msg-id="${tempId}"]`);
            if (pendingEl) pendingEl.setAttribute('data-msg-id', realMsg.id);
            const cached = state.messageCache.get(receiverId) || [];
            const idx = cached.findIndex(m => m.id === tempId);
            if (idx >= 0) cached[idx] = realMsg;
            else cached.push(realMsg);
            state.messageCache.set(receiverId, cached);
        }
        state.pendingMessages.delete(tempId);
    }

    function setupChatRealtime(partnerId) {
        if (state.chatChannel) { state.chatChannel.unsubscribe(); state.chatChannel = null; }
        if (!partnerId || !state.myId) return;
        const channelName = 'widget-chat-' + state.myId + '-' + partnerId;
        state.chatChannel = window.supabase
            .channel(channelName)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=in.(${state.myId},${partnerId})` }, (payload) => {
                const msg = payload.new;
                const relevant = (msg.sender_id === state.myId && msg.receiver_id === partnerId) || (msg.sender_id === partnerId && msg.receiver_id === state.myId);
                if (!relevant || state.pendingMessages.has(msg.id)) return;
                const container = document.getElementById('msg-widget-messages');
                if (container) {
                    if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
                    appendMessage(msg, container);
                }
                const cached = state.messageCache.get(partnerId) || [];
                if (!cached.some(m => m.id === msg.id)) { cached.push(msg); state.messageCache.set(partnerId, cached); }
                if (msg.receiver_id === state.myId) {
                    if (state.supabaseBlocked) restRpc('mark_messages_read', { partner: msg.sender_id }).catch(() => {});
                    else window.supabase.rpc('mark_messages_read', { partner: msg.sender_id }).catch(() => {});
                }
            })
            .subscribe(() => {});
    }

    function setupNotifyRealtime() {
        if (state.notifyChannel) { try { state.notifyChannel.unsubscribe(); } catch (e) {} state.notifyChannel = null; }
        if (!state.myId) return;
        const channelName = 'widget-notify-' + state.myId;
        state.notifyChannel = window.supabase
            .channel(channelName)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${state.myId}` }, (payload) => {
                const msg = payload.new;
                const cached = state.messageCache.get(msg.sender_id) || [];
                if (!cached.some(m => m.id === msg.id)) { cached.push(msg); state.messageCache.set(msg.sender_id, cached); }
                const isCurrentConv = state.isOpen && (state.isAdmin ? msg.sender_id === state.activePartner : msg.sender_id === state.teacherId);
                if (!isCurrentConv) {
                    updateUnreadBadge();
                    if (Notification.permission === 'granted' && !state.isOpen) {
                        new Notification('Nouveau message', { body: msg.content.substring(0, 60), icon: '💬' });
                    }
                } else {
                    const container = document.getElementById('msg-widget-messages');
                    if (container) {
                        if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
                        appendMessage(msg, container);
                    }
                    if (state.supabaseBlocked) restRpc('mark_messages_read', { partner: msg.sender_id }).catch(() => {});
                    else window.supabase.rpc('mark_messages_read', { partner: msg.sender_id }).catch(() => {});
                }
            })
            .subscribe(() => {});
    }

    async function updateUnreadBadge() {
        let partners = null;
        if (!state.supabaseBlocked) {
            try {
                const result = await withTimeout(window.supabase.rpc('get_conversation_partners'), 6000, 'rpc');
                if (!result.error) partners = result.data;
            } catch (err) { state.supabaseBlocked = true; }
        }
        if (!partners && state.supabaseBlocked) {
            try { partners = await restRpc('get_conversation_partners', {}); }
            catch (err2) { return; }
        }
        if (!partners) return;
        const total = partners.reduce((sum, p) => sum + (p.unread_count || 0), 0);
        state.unreadTotal = total;
        const bubble = document.getElementById('msg-widget-bubble');
        if (!bubble) return;
        if (total > 0) {
            bubble.classList.add('has-unread');
            bubble.setAttribute('data-unread', total > 99 ? '99+' : total);
        } else {
            bubble.classList.remove('has-unread');
            bubble.removeAttribute('data-unread');
        }
    }

    function listenForAuthChanges() {
        if (!window.supabase) return;
        window.supabase.auth.onAuthStateChange((event, session) => {
            if (session?.access_token) state.accessToken = session.access_token;
        });
    }

    async function init() {
        try {
            const { client, user } = await waitForSupabase();
            const roleOk = await detectRole(client, user);
            if (!roleOk) return;
            createWidget();
            if (!state.isAdmin && state.teacherId) setupPresence(state.teacherId);
            await updateUnreadBadge();
            setupNotifyRealtime();
            listenForAuthChanges();
            setInterval(() => { if (!state.isOpen) updateUnreadBadge(); }, 15000);
            if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        } catch (err) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();