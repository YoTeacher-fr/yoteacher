// ========== MESSAGING WIDGET — VERSION AVEC PRÉSENCE & TYPING
// Fallback REST + Realtime broadcast pour statut online & typing indicator

(function() {
    'use strict';

    const DEBUG = true;
    function log(label, data) {
        if (!DEBUG) return;
        const prefix = '[WIDGET-DEBUG ' + new Date().toISOString().substr(11, 8) + '] ' + label;
        if (data !== undefined) console.log(prefix, data);
        else console.log(prefix);
    }

    // ========== UTILITAIRES ==========
    function withTimeout(promise, ms = 8000, label = 'req') {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
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
        } catch (e) { log('⚠️ getStoredToken error:', e.message); }
        return null;
    }

    // ========== FETCH DIRECT REST ==========
    async function restRpc(functionName, params = {}) {
        const token = getStoredToken();
        if (!token) throw new Error('Pas de token');
        const url = `${window.YOTEACHER_CONFIG.SUPABASE_URL}/rest/v1/rpc/${functionName}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
        }
        if (res.status === 204) return null;
        return await res.json();
    }

    async function restInsert(table, row) {
        const token = getStoredToken();
        if (!token) throw new Error('Pas de token');
        const url = `${window.YOTEACHER_CONFIG.SUPABASE_URL}/rest/v1/${table}`;
        const res = await fetch(url, {
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
            throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
        }
        return await res.json();
    }

    // ========== ÉTAT ==========
    let state = {
        isOpen: false,
        isAdmin: false,
        myId: null,
        teacherId: null,
        teacherName: null,
        activePartner: null,
        messageCache: new Map(),
        conversations: [],
        notifyChannel: null,
        chatChannel: null,
        pendingMessages: new Set(),
        supabaseBlocked: false,
        accessToken: null,
        unreadTotal: 0,
        // --- NOUVEAU : présence ---
        presenceChannel: null,
        currentPresencePartner: null,
        lastPartnerHeartbeat: 0,
        heartbeatTimer: null,
        onlineCheckTimer: null,
        typingTimer: null
    };

    function escapeHtml(str) {
        return (str || '').replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]));
    }
    function formatTime(iso) {
        return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    function formatDateShort(iso) {
        const d = new Date(iso);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) return formatTime(iso);
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    // ==========================================
    // PRÉSENCE & TYPING
    // ==========================================
    function setupPresence(partnerId) {
        if (!partnerId || !state.myId) return;
        if (state.presenceChannel && state.currentPresencePartner === partnerId) return;

        log('=== setupPresence ===');
        if (state.presenceChannel) {
            try { state.presenceChannel.unsubscribe(); } catch (e) {}
            state.presenceChannel = null;
        }
        state.currentPresencePartner = partnerId;
        state.lastPartnerHeartbeat = Date.now(); // optimiste au départ

        const channelName = 'widget-presence-' + [state.myId, partnerId].sort().join('-');
        log('Presence channel:', channelName);

        state.presenceChannel = window.supabase
            .channel(channelName)
            .on('broadcast', { event: 'heartbeat' }, (payload) => {
                const p = payload.payload;
                if (p && p.userId === partnerId) {
                    state.lastPartnerHeartbeat = Date.now();
                    updateOnlineStatus(true);
                    log('💓 Heartbeat reçu de', partnerId);
                }
            })
            .on('broadcast', { event: 'typing' }, (payload) => {
                const p = payload.payload;
                if (p && p.userId === partnerId) {
                    showTypingIndicator();
                    log('⌨️ Typing reçu de', partnerId);
                }
            })
            .subscribe((status) => {
                log('Presence channel status:', status);
                if (status === 'SUBSCRIBED') {
                    // Heartbeat immédiat
                    state.presenceChannel.send({
                        type: 'broadcast',
                        event: 'heartbeat',
                        payload: { userId: state.myId, timestamp: Date.now() }
                    }).catch(() => {});
                }
            });

        // Heartbeat toutes les 10s
        if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
        state.heartbeatTimer = setInterval(() => {
            if (state.presenceChannel) {
                state.presenceChannel.send({
                    type: 'broadcast',
                    event: 'heartbeat',
                    payload: { userId: state.myId, timestamp: Date.now() }
                }).catch(() => {});
            }
        }, 10000);

        // Vérification statut toutes les 5s
        if (state.onlineCheckTimer) clearInterval(state.onlineCheckTimer);
        state.onlineCheckTimer = setInterval(() => {
            const isOnline = Date.now() - state.lastPartnerHeartbeat < 20000;
            updateOnlineStatus(isOnline);
        }, 5000);
    }

    function updateOnlineStatus(isOnline) {
        const dot = document.getElementById('msg-widget-status-dot');
        const text = document.getElementById('msg-widget-status-text');
        if (!dot || !text) return;
        if (isOnline) {
            dot.classList.remove('offline');
            text.textContent = 'En ligne';
        } else {
            dot.classList.add('offline');
            text.textContent = 'Hors ligne';
        }
    }

    function showTypingIndicator() {
        const el = document.getElementById('msg-widget-typing');
        if (!el) return;
        const name = state.isAdmin ? "L'étudiant" : "Le professeur";
        el.textContent = name + " est en train d'écrire…";
        el.style.display = 'block';
        if (state.typingTimer) clearTimeout(state.typingTimer);
        state.typingTimer = setTimeout(() => {
            if (el) el.style.display = 'none';
        }, 3000);
    }

    function setupTypingListener(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        let debounceTimer;
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (state.presenceChannel) {
                    state.presenceChannel.send({
                        type: 'broadcast',
                        event: 'typing',
                        payload: { userId: state.myId }
                    }).catch(() => {});
                }
            }, 300);
        });
    }

    // ==========================================
    // ÉTAPE 1 : ATTENTE SUPABASE
    // ==========================================
    async function waitForSupabase() {
        log('=== ÉTAPE 1 : waitForSupabase ===');
        const start = Date.now();
        while (Date.now() - start < 15000) {
            if (window.supabase && window.supabase.auth) {
                try {
                    const { data, error } = await window.supabase.auth.getUser();
                    if (!error && data?.user) {
                        log('✅ Supabase prêt, user.id:', data.user.id);
                        return { client: window.supabase, user: data.user };
                    }
                } catch (e) { log('getUser() throw:', e.message); }
            }
            await new Promise(r => setTimeout(r, 200));
        }
        throw new Error('Supabase timeout');
    }

    // ==========================================
    // ÉTAPE 2 : DÉTECTION RÔLE
    // ==========================================
    async function detectRole(client, user) {
        log('=== ÉTAPE 2 : detectRole ===');
        state.myId = user.id;
        try {
            const { data: { session } } = await client.auth.getSession();
            if (session?.access_token) {
                state.accessToken = session.access_token;
                log('🔑 Token stocké en mémoire');
            }
            if (!session?.access_token && !getStoredToken()) {
                log('❌ AUCUN TOKEN');
                return false;
            }

            const url = window.YOTEACHER_CONFIG?.SUPABASE_URL + '/functions/v1/teacher-info';
            const res = await fetch(url, {
                headers: { Authorization: 'Bearer ' + (state.accessToken || getStoredToken()) }
            });
            if (!res.ok) { log('❌ Edge function failed:', res.status); return false; }

            const teacher = await res.json();
            log('Edge function:', JSON.stringify(teacher));

            if (teacher.id === user.id) {
                state.isAdmin = true;
                state.teacherId = user.id;
                log('✅ Mode ADMIN');
            } else {
                state.teacherId = teacher.id;
                state.teacherName = teacher.full_name;
                state.isAdmin = false;
                log('✅ Mode ÉTUDIANT, teacherId:', teacher.id);
            }
            return true;
        } catch (err) {
            log('❌ detectRole throw:', err.message);
            return false;
        }
    }

    // ==========================================
    // ÉTAPE 3 : CRÉATION DOM
    // ==========================================
    function createWidget() {
        log('=== ÉTAPE 3 : createWidget ===');
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
        log('✅ Widget DOM créé');
    }

    function toggleWindow() {
        log('=== toggleWindow ===');
        const win = document.getElementById('msg-widget-window');
        if (!win) return;
        if (state.isOpen) {
            win.classList.add('closing');
            setTimeout(() => {
                win.style.display = 'none';
                win.classList.remove('closing');
                state.isOpen = false;
                state.activePartner = null;
                if (state.chatChannel) { state.chatChannel.unsubscribe(); state.chatChannel = null; }
            }, 250);
        } else {
            state.isOpen = true;
            win.style.display = 'flex';
            state.isAdmin ? renderAdminConversations() : renderStudentChat();
        }
    }
    function closeWindow() { if (state.isOpen) toggleWindow(); }

    // ==========================================
    // ÉTAPE 4 : RENDU ÉTUDIANT
    // ==========================================
    async function renderStudentChat() {
        log('=== ÉTAPE 4 : renderStudentChat ===');
        const win = document.getElementById('msg-widget-window');
        if (!win || !state.teacherId) { log('❌ win ou teacherId null'); return; }

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
        if (cached && cached.length > 0) {
            renderMessagesToContainer(cached, container);
        } else {
            container.innerHTML = `<div class="messaging-widget-empty"><i class="fas fa-comment-slash"></i><p>Aucun message encore.<br>Commencez la conversation !</p></div>`;
        }
        await loadMessages(state.teacherId);
        setupChatRealtime(state.teacherId);
        setupPresence(state.teacherId);
        setupTypingListener('msg-widget-input');
        updateOnlineStatus(Date.now() - state.lastPartnerHeartbeat < 20000);
    }

    // ==========================================
    // ÉTAPE 5 : RENDU ADMIN - LISTE
    // ==========================================
    async function renderAdminConversations() {
        log('=== ÉTAPE 5 : renderAdminConversations ===');
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

    // ==========================================
    // ÉTAPE 6 : RENDU ADMIN - CHAT
    // ==========================================
    async function renderAdminChat(partnerId, partnerName) {
        log('=== ÉTAPE 6 : renderAdminChat ===');
        const win = document.getElementById('msg-widget-window');
        if (!win) return;
        state.activePartner = partnerId;
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
            state.activePartner = null;
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

    // ==========================================
    // ÉTAPE 7 : CHARGEMENT MESSAGES (fallback REST)
    // ==========================================
    async function loadMessages(partnerId) {
        log('=== ÉTAPE 7 : loadMessages ===');
        const container = document.getElementById('msg-widget-messages');
        if (!container) { log('❌ Container null'); return; }

        let msgs = null;
        let error = null;

        if (!state.supabaseBlocked) {
            try {
                log('Appel RPC get_messages_with (supabase)...');
                const result = await withTimeout(
                    window.supabase.rpc('get_messages_with', { partner: partnerId }),
                    6000,
                    'rpc-get_messages_with'
                );
                msgs = result.data;
                error = result.error;
                if (!error) log('✅ RPC supabase OK:', msgs?.length, 'messages');
            } catch (err) {
                log('⚠️ RPC supabase échoué:', err.message);
                state.supabaseBlocked = true;
            }
        }

        if (!msgs && state.supabaseBlocked) {
            try {
                log('🔄 Fallback REST get_messages_with...');
                msgs = await restRpc('get_messages_with', { partner: partnerId });
                log('✅ Fallback REST OK:', msgs?.length, 'messages');
                error = null;
            } catch (err2) {
                log('❌ Fallback REST échoué:', err2.message);
                error = err2;
            }
        }

        if (error) {
            log('❌ loadMessages final error:', error.message);
            return;
        }

        if (msgs) {
            state.messageCache.set(partnerId, msgs);
            renderMessagesToContainer(msgs, container);
            container.scrollTop = container.scrollHeight;
        }

        try {
            if (state.supabaseBlocked) {
                restRpc('mark_messages_read', { partner: partnerId }).catch(() => {});
            } else {
                window.supabase.rpc('mark_messages_read', { partner: partnerId }).catch(() => {});
            }
        } catch (e) {}
    }

    // ==========================================
    // ÉTAPE 8 : CHARGEMENT CONVERSATIONS ADMIN
    // ==========================================
    async function loadAdminConversations() {
        log('=== ÉTAPE 8 : loadAdminConversations ===');
        const container = document.getElementById('msg-widget-conversations');
        if (!container) { log('❌ Container null'); return; }

        let partners = null;
        let error = null;

        if (!state.supabaseBlocked) {
            try {
                log('Appel RPC get_conversation_partners (supabase)...');
                const result = await withTimeout(
                    window.supabase.rpc('get_conversation_partners'),
                    6000,
                    'rpc-get_conversation_partners'
                );
                partners = result.data;
                error = result.error;
                if (!error) log('✅ RPC supabase OK:', partners?.length, 'conversations');
            } catch (err) {
                log('⚠️ RPC supabase échoué:', err.message);
                state.supabaseBlocked = true;
            }
        }

        if (!partners && state.supabaseBlocked) {
            try {
                log('🔄 Fallback REST get_conversation_partners...');
                partners = await restRpc('get_conversation_partners', {});
                log('✅ Fallback REST OK:', partners?.length, 'conversations');
                error = null;
            } catch (err2) {
                log('❌ Fallback REST échoué:', err2.message);
                error = err2;
            }
        }

        if (error) {
            container.innerHTML = `<div class="messaging-widget-empty"><p>Erreur: ${escapeHtml(error.message)}</p></div>`;
            return;
        }

        state.conversations = partners || [];
        container.innerHTML = '';

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
        log('=== renderMessagesToContainer ===');
        if (!msgs || msgs.length === 0) {
            if (!container.querySelector('.messaging-widget-msg')) {
                container.innerHTML = `<div class="messaging-widget-empty"><i class="fas fa-comment-slash"></i><p>Aucun message encore.<br>Commencez la conversation !</p></div>`;
            }
            return;
        }
        container.innerHTML = '';
        msgs.forEach(m => appendMessage(m, container));
    }

    function appendMessage(msg, container) {
        const existing = container.querySelector(`[data-msg-id="${msg.id}"]`);
        if (existing) { log('Message déjà dans DOM:', msg.id); return; }
        const isMe = msg.sender_id === state.myId;
        const div = document.createElement('div');
        div.className = `messaging-widget-msg ${isMe ? 'sent' : 'received'}`;
        div.setAttribute('data-msg-id', msg.id || 'pending-' + Date.now());
        div.innerHTML = `${escapeHtml(msg.content)}<span class="messaging-widget-msg-time">${formatTime(msg.created_at)}</span>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // ==========================================
    // ÉTAPE 9 : ENVOI (fallback REST)
    // ==========================================
    async function sendMessage() {
        log('=== ÉTAPE 9 : sendMessage ===');
        const input = document.getElementById('msg-widget-input');
        const content = input?.value.trim();
        if (!content) return;

        const receiverId = state.isAdmin ? state.activePartner : state.teacherId;
        if (!receiverId) { log('❌ receiverId null'); return; }
        if (input) input.value = '';

        const tempId = 'pending-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        state.pendingMessages.add(tempId);

        const container = document.getElementById('msg-widget-messages');
        if (container) {
            if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
            appendMessage({ id: tempId, sender_id: state.myId, receiver_id: receiverId, content, created_at: new Date().toISOString() }, container);
        }

        let data = null;
        let error = null;

        if (!state.supabaseBlocked) {
            try {
                log('INSERT via supabase...');
                const result = await withTimeout(
                    window.supabase.from('messages').insert({ sender_id: state.myId, receiver_id: receiverId, content }).select(),
                    6000,
                    'insert-msg'
                );
                data = result.data;
                error = result.error;
            } catch (err) {
                log('⚠️ INSERT supabase timeout:', err.message);
                state.supabaseBlocked = true;
            }
        }

        if (!data && state.supabaseBlocked) {
            try {
                log('🔄 Fallback REST INSERT...');
                data = await restInsert('messages', { sender_id: state.myId, receiver_id: receiverId, content });
                log('✅ Fallback INSERT OK:', data?.[0]?.id);
                error = null;
            } catch (err2) {
                log('❌ Fallback INSERT échoué:', err2.message);
                error = err2;
            }
        }

        if (error) {
            log('❌ Envoi final échoué:', error.message);
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
        log('✅ Envoi terminé');
    }

    // ==========================================
    // ÉTAPE 10 : REALTIME CHAT
    // ==========================================
    function setupChatRealtime(partnerId) {
        log('=== ÉTAPE 10 : setupChatRealtime ===');
        if (state.chatChannel) { state.chatChannel.unsubscribe(); state.chatChannel = null; }
        if (!partnerId || !state.myId) return;

        const channelName = 'widget-chat-' + state.myId + '-' + partnerId;
        state.chatChannel = window.supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'messages',
                filter: `receiver_id=in.(${state.myId},${partnerId})`
            }, (payload) => {
                const msg = payload.new;
                const relevant = (msg.sender_id === state.myId && msg.receiver_id === partnerId) ||
                                 (msg.sender_id === partnerId && msg.receiver_id === state.myId);
                if (!relevant || state.pendingMessages.has(msg.id)) return;

                const container = document.getElementById('msg-widget-messages');
                if (container) {
                    if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
                    appendMessage(msg, container);
                }
                const cached = state.messageCache.get(partnerId) || [];
                if (!cached.some(m => m.id === msg.id)) {
                    cached.push(msg);
                    state.messageCache.set(partnerId, cached);
                }
                if (msg.receiver_id === state.myId) {
                    if (state.supabaseBlocked) {
                        restRpc('mark_messages_read', { partner: msg.sender_id }).catch(() => {});
                    } else {
                        window.supabase.rpc('mark_messages_read', { partner: msg.sender_id }).catch(() => {});
                    }
                }
            })
            .subscribe((status) => { log('Chat channel status:', status); });
    }

    // ==========================================
    // ÉTAPE 11 : REALTIME NOTIFY
    // ==========================================
    function setupNotifyRealtime() {
        log('=== ÉTAPE 11 : setupNotifyRealtime ===');
        if (state.notifyChannel) { try { state.notifyChannel.unsubscribe(); } catch (e) {} state.notifyChannel = null; }
        if (!state.myId) return;

        const channelName = 'widget-notify-' + state.myId;
        state.notifyChannel = window.supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'messages',
                filter: `receiver_id=eq.${state.myId}`
            }, (payload) => {
                log('=== NOTIFY realtime event ===');
                const msg = payload.new;
                const cached = state.messageCache.get(msg.sender_id) || [];
                if (!cached.some(m => m.id === msg.id)) { cached.push(msg); state.messageCache.set(msg.sender_id, cached); }

                const isCurrentConv = state.isOpen && (
                    state.isAdmin ? msg.sender_id === state.activePartner : msg.sender_id === state.teacherId
                );

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
                    if (state.supabaseBlocked) {
                        restRpc('mark_messages_read', { partner: msg.sender_id }).catch(() => {});
                    } else {
                        window.supabase.rpc('mark_messages_read', { partner: msg.sender_id }).catch(() => {});
                    }
                }
            })
            .subscribe((status) => { log('Notify channel status:', status); });
    }

    // ==========================================
    // ÉTAPE 12 : BADGE (fallback REST)
    // ==========================================
    async function updateUnreadBadge() {
        log('=== ÉTAPE 12 : updateUnreadBadge ===');
        let partners = null;

        if (!state.supabaseBlocked) {
            try {
                log('Badge via supabase...');
                const result = await withTimeout(
                    window.supabase.rpc('get_conversation_partners'),
                    6000,
                    'rpc-badge'
                );
                if (!result.error) {
                    partners = result.data;
                    log('✅ Badge supabase OK:', partners?.length);
                }
            } catch (err) {
                log('⚠️ Badge supabase timeout:', err.message);
                state.supabaseBlocked = true;
            }
        }

        if (!partners && state.supabaseBlocked) {
            try {
                log('🔄 Badge fallback REST...');
                partners = await restRpc('get_conversation_partners', {});
                log('✅ Badge fallback OK:', partners?.length);
            } catch (err2) {
                log('❌ Badge fallback échoué:', err2.message);
                return;
            }
        }

        if (!partners) return;

        const total = partners.reduce((sum, p) => sum + (p.unread_count || 0), 0);
        state.unreadTotal = total;
        log('Total non-lus:', total);

        const bubble = document.getElementById('msg-widget-bubble');
        if (!bubble) return;
        if (total > 0) {
            bubble.classList.add('has-unread');
            bubble.setAttribute('data-unread', total > 99 ? '99+' : total);
            log('Badge affiché:', total);
        } else {
            bubble.classList.remove('has-unread');
            bubble.removeAttribute('data-unread');
            log('Badge retiré');
        }
    }

    // ==========================================
    // ÉTAPE 13 : AUTH CHANGES
    // ==========================================
    function listenForAuthChanges() {
        log('=== ÉTAPE 13 : listenForAuthChanges ===');
        if (!window.supabase) return;
        window.supabase.auth.onAuthStateChange((event, session) => {
            log('Auth event:', event);
            if (session?.access_token) {
                state.accessToken = session.access_token;
                log('🔑 Token mis à jour');
            }
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                log('🔄 Auth refresh détecté — fallbacks REST actifs');
            }
        });
    }

    // ==========================================
    // ÉTAPE 14 : INITIALISATION
    // ==========================================
    async function init() {
        log('========================================');
        log('🚀 DÉMARRAGE WIDGET');
        log('========================================');
        try {
            const { client, user } = await waitForSupabase();
            log('Supabase prêt, user:', user.email);

            const roleOk = await detectRole(client, user);
            if (!roleOk) { log('❌ Rôle non détecté'); return; }

            createWidget();

            // Setup présence permanente pour l'étudiant (teacherId ne change jamais)
            if (!state.isAdmin && state.teacherId) {
                setupPresence(state.teacherId);
            }

            await updateUnreadBadge();
            setupNotifyRealtime();
            listenForAuthChanges();

            setInterval(() => {
                if (!state.isOpen) updateUnreadBadge();
            }, 15000);

            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }

            log('✅ WIDGET INITIALISÉ');
            log('========================================');
        } catch (err) {
            log('❌ Init failed:', err.message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();