// ========== MESSAGING WIDGET — PRODUCTION (avec avatars)
// Fallback REST + Realtime broadcast + avatars

(function() {
    'use strict';

    const DEBUG = false;
    function log(label, data) {
        if (!DEBUG) return;
        const prefix = '[WIDGET] ' + label;
        if (data !== undefined) console.log(prefix, data);
        else console.log(prefix);
    }

    function withTimeout(promise, ms, label) {
        ms = ms || 8000;
        label = label || 'req';
        var timeoutPromise = new Promise(function(_, reject) {
            setTimeout(function() { reject(new Error(label + ' timeout')); }, ms);
        });
        return Promise.race([promise, timeoutPromise]);
    }

    function getStoredToken() {
        if (state.accessToken) return state.accessToken;
        try {
            var url = new URL(window.YOTEACHER_CONFIG.SUPABASE_URL);
            var projectRef = url.hostname.split('.')[0];
            var key = 'sb-' + projectRef + '-auth-token';
            var stored = localStorage.getItem(key);
            if (stored) {
                var parsed = JSON.parse(stored);
                if (parsed.access_token) {
                    state.accessToken = parsed.access_token;
                    return parsed.access_token;
                }
            }
        } catch (e) {}
        return null;
    }

    async function restRpc(functionName, params) {
        var token = getStoredToken();
        if (!token) throw new Error('Pas de token');
        var res = await fetch(window.YOTEACHER_CONFIG.SUPABASE_URL + '/rest/v1/rpc/' + functionName, {
            method: 'POST',
            headers: {
                'apikey': window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params || {})
        });
        if (!res.ok) {
            var text = await res.text().catch(function() { return ''; });
            throw new Error('HTTP ' + res.status);
        }
        if (res.status === 204) return null;
        return await res.json();
    }

    async function restInsert(table, row) {
        var token = getStoredToken();
        if (!token) throw new Error('Pas de token');
        var res = await fetch(window.YOTEACHER_CONFIG.SUPABASE_URL + '/rest/v1/' + table, {
            method: 'POST',
            headers: {
                'apikey': window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(row)
        });
        if (!res.ok) {
            var text = await res.text().catch(function() { return ''; });
            throw new Error('HTTP ' + res.status);
        }
        return await res.json();
    }

    async function restSelect(table, query) {
        var token = getStoredToken();
        if (!token) throw new Error('Pas de token');
        var url = window.YOTEACHER_CONFIG.SUPABASE_URL + '/rest/v1/' + table + '?' + (query || '');
        var res = await fetch(url, {
            headers: {
                'apikey': window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + token
            }
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    }

    var state = {
        isOpen: false, isAdmin: false, myId: null, teacherId: null,
        teacherName: null, activePartner: null, messageCache: new Map(),
        conversations: [], notifyChannel: null, chatChannel: null,
        pendingMessages: new Set(), supabaseBlocked: false,
        accessToken: null, unreadTotal: 0,
        presenceChannel: null, currentPresencePartner: null,
        lastPartnerHeartbeat: 0, heartbeatTimer: null, onlineCheckTimer: null,
        isTyping: false,
        partnerProfile: null // ← avatar + nom du partenaire
    };

    function escapeHtml(str) {
        return (str || '').replace(/[&<>]/g, function(m) {
            return ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m];
        });
    }

    // ========== FORMATAGE DATE INTELLIGENT ==========
    function formatMessageDate(iso) {
        var d = new Date(iso);
        var now = new Date();
        var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        var msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        var time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        if (msgDay.getTime() === today.getTime()) return time;
        if (msgDay.getTime() === yesterday.getTime()) return 'Hier ' + time;
        var dayDiff = Math.floor((today - msgDay) / (1000 * 60 * 60 * 24));
        if (dayDiff < 7 && d.getDay() <= now.getDay()) {
            var dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' });
            return dayName.charAt(0).toUpperCase() + dayName.slice(1) + ' ' + time;
        }
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + time;
    }

    function formatDateShort(iso) {
        var d = new Date(iso), now = new Date();
        if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    // ========== AVATAR HELPERS ==========
    function getInitials(name) {
        if (!name) return '??';
        var parts = name.trim().split(/\s+/).filter(function(n) { return n.length > 0; });
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    }

    function renderAvatarHtml(profile, size) {
        size = size || 32;
        var style = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:' + (size * 0.4) + 'px;font-weight:600;';
        if (profile && profile.avatar_url) {
            return '<img src="' + escapeHtml(profile.avatar_url) + '" style="' + style + 'object-fit:cover;" alt="avatar" onerror="this.style.display='none';this.parentNode.innerHTML='<span style=background:linear-gradient(135deg,#3c84f6,#2c3e50);color:white;' + style + ''>' + getInitials(profile.full_name) + '</span>';">';
        }
        return '<span style="' + style + 'background:linear-gradient(135deg,#3c84f6,#2c3e50);color:white;">' + getInitials(profile ? profile.full_name : '') + '</span>';
    }

    function setupPresence(partnerId) {
        if (!partnerId || !state.myId) return;
        if (state.presenceChannel && state.currentPresencePartner === partnerId) return;
        if (state.presenceChannel) { try { state.presenceChannel.unsubscribe(); } catch (e) {} state.presenceChannel = null; }
        state.currentPresencePartner = partnerId;
        state.lastPartnerHeartbeat = Date.now();
        var channelName = 'widget-presence-' + [state.myId, partnerId].sort().join('-');
        state.presenceChannel = window.supabase
            .channel(channelName)
            .on('broadcast', { event: 'heartbeat' }, function(payload) {
                var p = payload.payload;
                if (p && p.userId === partnerId) {
                    state.lastPartnerHeartbeat = Date.now();
                    updateOnlineStatus(true);
                }
            })
            .on('broadcast', { event: 'typing' }, function(payload) {
                var p = payload.payload;
                if (p && p.userId === partnerId) {
                    p.active ? showTypingIndicator() : hideTypingIndicator();
                }
            })
            .subscribe(function(status) {
                if (status === 'SUBSCRIBED' && state.presenceChannel) {
                    state.presenceChannel.send({ type: 'broadcast', event: 'heartbeat', payload: { userId: state.myId, timestamp: Date.now() }}).catch(function(){});
                }
            });
        if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
        state.heartbeatTimer = setInterval(function() {
            if (state.presenceChannel) {
                state.presenceChannel.send({ type: 'broadcast', event: 'heartbeat', payload: { userId: state.myId, timestamp: Date.now() }}).catch(function(){});
            }
        }, 10000);
        if (state.onlineCheckTimer) clearInterval(state.onlineCheckTimer);
        state.onlineCheckTimer = setInterval(function() {
            updateOnlineStatus(Date.now() - state.lastPartnerHeartbeat < 20000);
        }, 5000);
    }

    function updateOnlineStatus(isOnline) {
        var dot = document.getElementById('msg-widget-status-dot');
        var text = document.getElementById('msg-widget-status-text');
        if (!dot || !text) return;
        if (isOnline) { dot.classList.remove('offline'); text.textContent = 'En ligne'; }
        else { dot.classList.add('offline'); text.textContent = 'Hors ligne'; }
    }

    function showTypingIndicator() {
        var el = document.getElementById('msg-widget-typing');
        if (!el) return;
        var name = state.isAdmin ? "L'étudiant" : "Le professeur";
        el.textContent = name + " est en train d'écrire…";
        el.style.display = 'flex';
    }

    function hideTypingIndicator() {
        var el = document.getElementById('msg-widget-typing');
        if (el) el.style.display = 'none';
    }

    function setupTypingListener(inputId) {
        var input = document.getElementById(inputId);
        if (!input) return;
        input.addEventListener('input', function() {
            var hasText = input.value.trim().length > 0;
            if (hasText && !state.isTyping) { state.isTyping = true; broadcastTyping(true); }
            else if (!hasText && state.isTyping) { state.isTyping = false; broadcastTyping(false); }
        });
        window.addEventListener('beforeunload', function() { if (state.isTyping) broadcastTyping(false); });
    }

    function broadcastTyping(active) {
        if (!state.presenceChannel) return;
        state.presenceChannel.send({ type: 'broadcast', event: 'typing', payload: { userId: state.myId, active: active }}).catch(function(){});
    }

    async function waitForSupabase() {
        var start = Date.now();
        while (Date.now() - start < 15000) {
            if (window.supabase && window.supabase.auth) {
                try {
                    var result = await window.supabase.auth.getUser();
                    if (!result.error && result.data && result.data.user) return { client: window.supabase, user: result.data.user };
                } catch (e) {}
            }
            await new Promise(function(r) { setTimeout(r, 200); });
        }
        throw new Error('Supabase timeout');
    }

    async function detectRole(client, user) {
        state.myId = user.id;
        try {
            var sessionResult = await client.auth.getSession();
            var session = sessionResult.data && sessionResult.data.session;
            if (session && session.access_token) state.accessToken = session.access_token;
            if (!session && !getStoredToken()) return false;
            var res = await fetch(window.YOTEACHER_CONFIG.SUPABASE_URL + '/functions/v1/teacher-info', {
                headers: { Authorization: 'Bearer ' + (state.accessToken || getStoredToken()) }
            });
            if (!res.ok) return false;
            var teacher = await res.json();
            if (teacher.id === user.id) { state.isAdmin = true; state.teacherId = user.id; }
            else { state.teacherId = teacher.id; state.teacherName = teacher.full_name; state.isAdmin = false; }
            return true;
        } catch (err) { return false; }
    }

    function createWidget() {
        if (document.getElementById('messaging-widget-root')) return;
        var root = document.createElement('div');
        root.id = 'messaging-widget-root';
        root.innerHTML = '<button id="msg-widget-bubble" class="messaging-widget-bubble" title="Messagerie"><i class="fas fa-comment-dots"></i></button><div id="msg-widget-window" class="messaging-widget-window" style="display:none;"></div>';
        document.body.appendChild(root);
        document.getElementById('msg-widget-bubble').addEventListener('click', toggleWindow);
    }

    function toggleWindow() {
        var win = document.getElementById('msg-widget-window');
        if (!win) return;
        if (state.isOpen) {
            win.classList.add('closing');
            setTimeout(function() {
                win.style.display = 'none'; win.classList.remove('closing');
                state.isOpen = false; state.activePartner = null; state.isTyping = false;
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

    // ========== CHARGEMENT PROFIL PARTENAIRE ==========
    async function loadPartnerProfile(partnerId) {
        if (state.partnerProfile && state.partnerProfile.id === partnerId) return state.partnerProfile;
        try {
            var data;
            if (!state.supabaseBlocked) {
                try {
                    var result = await withTimeout(window.supabase.from('profiles').select('id,full_name,avatar_url').eq('id', partnerId).single(), 6000, 'profile');
                    data = result.data;
                } catch (err) { state.supabaseBlocked = true; }
            }
            if (!data && state.supabaseBlocked) {
                var rows = await restSelect('profiles', 'id=eq.' + partnerId + '&select=id,full_name,avatar_url');
                data = rows && rows[0];
            }
            state.partnerProfile = data || { id: partnerId, full_name: state.isAdmin ? 'Étudiant' : state.teacherName, avatar_url: null };
            return state.partnerProfile;
        } catch (e) {
            state.partnerProfile = { id: partnerId, full_name: state.isAdmin ? 'Étudiant' : state.teacherName, avatar_url: null };
            return state.partnerProfile;
        }
    }

    async function renderStudentChat() {
        var win = document.getElementById('msg-widget-window');
        if (!win || !state.teacherId) return;
        var cached = state.messageCache.get(state.teacherId);
        // Charger le profil du professeur
        await loadPartnerProfile(state.teacherId);
        win.innerHTML = '<div class="messaging-widget-header"><div class="messaging-widget-header-info"><div class="messaging-widget-avatar">👨‍🏫</div><div class="messaging-widget-header-text"><div class="messaging-widget-header-name">' + escapeHtml(state.teacherName || 'Professeur') + '</div><div class="messaging-widget-header-status"><span class="messaging-widget-status-dot" id="msg-widget-status-dot"></span><span id="msg-widget-status-text">En ligne</span></div></div></div><button class="messaging-widget-close" id="msg-widget-close"><i class="fas fa-times"></i></button></div><div class="messaging-widget-messages" id="msg-widget-messages"></div><div class="messaging-widget-typing" id="msg-widget-typing" style="display:none;"></div><div class="messaging-widget-input-area"><input type="text" class="messaging-widget-input" id="msg-widget-input" placeholder="Écrivez un message..." autocomplete="off"><button class="messaging-widget-send" id="msg-widget-send"><i class="fas fa-paper-plane"></i></button></div>';
        document.getElementById('msg-widget-close').addEventListener('click', closeWindow);
        document.getElementById('msg-widget-send').addEventListener('click', sendMessage);
        document.getElementById('msg-widget-input').addEventListener('keypress', function(e) { if (e.key === 'Enter') sendMessage(); });
        var container = document.getElementById('msg-widget-messages');
        if (cached && cached.length > 0) renderMessagesToContainer(cached, container);
        else container.innerHTML = '<div class="messaging-widget-empty"><i class="fas fa-comment-slash"></i><p>Aucun message encore.<br>Commencez la conversation !</p></div>';
        await loadMessages(state.teacherId);
        setupChatRealtime(state.teacherId);
        setupPresence(state.teacherId);
        setupTypingListener('msg-widget-input');
        updateOnlineStatus(Date.now() - state.lastPartnerHeartbeat < 20000);
    }

    async function renderAdminConversations() {
        var win = document.getElementById('msg-widget-window');
        if (!win) return;
        win.innerHTML = '<div class="messaging-widget-header"><div class="messaging-widget-header-info"><div class="messaging-widget-avatar"><i class="fas fa-comments"></i></div><div class="messaging-widget-header-text"><div class="messaging-widget-header-name">Messagerie</div><div class="messaging-widget-header-status">Conversations avec vos étudiants</div></div></div><button class="messaging-widget-close" id="msg-widget-close"><i class="fas fa-times"></i></button></div><div class="messaging-widget-conversations" id="msg-widget-conversations"><div class="messaging-widget-empty"><i class="fas fa-spinner fa-spin"></i><p>Chargement...</p></div></div>';
        document.getElementById('msg-widget-close').addEventListener('click', closeWindow);
        await loadAdminConversations();
    }

    async function renderAdminChat(partnerId, partnerName) {
        var win = document.getElementById('msg-widget-window');
        if (!win) return;
        state.activePartner = partnerId;
        var cached = state.messageCache.get(partnerId);
        await loadPartnerProfile(partnerId);
        win.innerHTML = '<div class="messaging-widget-header"><button class="messaging-widget-back" id="msg-widget-back"><i class="fas fa-arrow-left"></i></button><div class="messaging-widget-header-info"><div class="messaging-widget-avatar">🎓</div><div class="messaging-widget-header-text"><div class="messaging-widget-header-name">' + escapeHtml(partnerName || 'Étudiant') + '</div><div class="messaging-widget-header-status"><span class="messaging-widget-status-dot" id="msg-widget-status-dot"></span><span id="msg-widget-status-text">En ligne</span></div></div></div><button class="messaging-widget-close" id="msg-widget-close"><i class="fas fa-times"></i></button></div><div class="messaging-widget-messages" id="msg-widget-messages"></div><div class="messaging-widget-typing" id="msg-widget-typing" style="display:none;"></div><div class="messaging-widget-input-area"><input type="text" class="messaging-widget-input" id="msg-widget-input" placeholder="Répondez à votre étudiant..." autocomplete="off"><button class="messaging-widget-send" id="msg-widget-send"><i class="fas fa-paper-plane"></i></button></div>';
        document.getElementById('msg-widget-back').addEventListener('click', function() {
            state.activePartner = null; state.isTyping = false;
            if (state.chatChannel) { state.chatChannel.unsubscribe(); state.chatChannel = null; }
            renderAdminConversations();
        });
        document.getElementById('msg-widget-close').addEventListener('click', closeWindow);
        document.getElementById('msg-widget-send').addEventListener('click', sendMessage);
        document.getElementById('msg-widget-input').addEventListener('keypress', function(e) { if (e.key === 'Enter') sendMessage(); });
        var container = document.getElementById('msg-widget-messages');
        if (cached && cached.length > 0) renderMessagesToContainer(cached, container);
        else container.innerHTML = '<div class="messaging-widget-empty"><i class="fas fa-comment-slash"></i><p>Aucun message encore.<br>Commencez la conversation !</p></div>';
        await loadMessages(partnerId);
        setupChatRealtime(partnerId);
        setupPresence(partnerId);
        setupTypingListener('msg-widget-input');
        updateOnlineStatus(Date.now() - state.lastPartnerHeartbeat < 20000);
    }

    async function loadMessages(partnerId) {
        var container = document.getElementById('msg-widget-messages');
        if (!container) return;
        var msgs = null, error = null;
        if (!state.supabaseBlocked) {
            try {
                var result = await withTimeout(window.supabase.rpc('get_messages_with', { partner: partnerId }), 6000, 'rpc');
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
            if (state.supabaseBlocked) restRpc('mark_messages_read', { partner: partnerId }).catch(function(){});
            else window.supabase.rpc('mark_messages_read', { partner: partnerId }).catch(function(){});
        } catch (e) {}
    }

    async function loadAdminConversations() {
        var container = document.getElementById('msg-widget-conversations');
        if (!container) return;
        var partners = null, error = null;
        if (!state.supabaseBlocked) {
            try {
                var result = await withTimeout(window.supabase.rpc('get_conversation_partners'), 6000, 'rpc');
                partners = result.data; error = result.error;
            } catch (err) { state.supabaseBlocked = true; }
        }
        if (!partners && state.supabaseBlocked) {
            try { partners = await restRpc('get_conversation_partners', {}); error = null; }
            catch (err2) { error = err2; }
        }
        if (error) { container.innerHTML = '<div class="messaging-widget-empty"><p>Erreur: ' + escapeHtml(error.message) + '</p></div>'; return; }
        state.conversations = partners || []; container.innerHTML = '';
        if (!partners || partners.length === 0) {
            container.innerHTML = '<div class="messaging-widget-empty"><i class="fas fa-inbox"></i><p>Aucune conversation pour le moment</p></div>';
            return;
        }
        partners.forEach(function(p) {
            var div = document.createElement('div');
            div.className = 'messaging-widget-conv-item';
            if (p.partner_id === state.activePartner) div.classList.add('active');
            var initials = (p.partner_name || 'É').substring(0, 2).toUpperCase();
            var time = p.last_message_at ? formatDateShort(p.last_message_at) : '';
            var unread = p.unread_count > 0 ? '<span class="messaging-widget-conv-badge">' + p.unread_count + '</span>' : '';
            div.innerHTML = '<div class="messaging-widget-conv-avatar">' + escapeHtml(initials) + '</div><div class="messaging-widget-conv-info"><div class="messaging-widget-conv-name">' + escapeHtml(p.partner_name || 'Étudiant') + '</div><div class="messaging-widget-conv-preview">Cliquez pour ouvrir</div></div><div class="messaging-widget-conv-meta"><span class="messaging-widget-conv-time">' + time + '</span>' + unread + '</div>';
            div.addEventListener('click', function() { renderAdminChat(p.partner_id, p.partner_name); });
            container.appendChild(div);
        });
    }

    function renderMessagesToContainer(msgs, container) {
        if (!msgs || msgs.length === 0) {
            if (!container.querySelector('.messaging-widget-msg')) {
                container.innerHTML = '<div class="messaging-widget-empty"><i class="fas fa-comment-slash"></i><p>Aucun message encore.<br>Commencez la conversation !</p></div>';
            }
            return;
        }
        container.innerHTML = '';
        msgs.forEach(function(m) { appendMessage(m, container); });
    }

    function appendMessage(msg, container) {
        var existing = container.querySelector('[data-msg-id="' + msg.id + '"]');
        if (existing) return;
        var isMe = msg.sender_id === state.myId;
        var div = document.createElement('div');
        div.className = 'messaging-widget-msg ' + (isMe ? 'sent' : 'received');
        div.setAttribute('data-msg-id', msg.id || 'pending-' + Date.now());

        // Avatar
        var avatarHtml = '';
        if (!isMe && state.partnerProfile) {
            avatarHtml = '<div class="msg-avatar-wrapper">' + renderAvatarHtml(state.partnerProfile, 28) + '</div>';
        } else if (isMe) {
            // Avatar de l'utilisateur courant (on n'a pas son profil, on utilise ses initiales)
            var myName = state.isAdmin ? 'Admin' : 'Moi';
            avatarHtml = '<div class="msg-avatar-wrapper">' + renderAvatarHtml({ full_name: myName }, 28) + '</div>';
        }

        div.innerHTML = avatarHtml + '<div class="msg-content-wrapper"><div class="msg-bubble">' + escapeHtml(msg.content) + '</div><span class="messaging-widget-msg-time">' + formatMessageDate(msg.created_at) + '</span></div>';
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    async function sendMessage() {
        var input = document.getElementById('msg-widget-input');
        var content = input && input.value.trim();
        if (!content) return;
        state.isTyping = false;
        broadcastTyping(false);
        var receiverId = state.isAdmin ? state.activePartner : state.teacherId;
        if (!receiverId) return;
        if (input) input.value = '';
        var tempId = 'pending-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        state.pendingMessages.add(tempId);
        var container = document.getElementById('msg-widget-messages');
        if (container) {
            if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
            appendMessage({ id: tempId, sender_id: state.myId, receiver_id: receiverId, content: content, created_at: new Date().toISOString() }, container);
        }
        var data = null, error = null;
        if (!state.supabaseBlocked) {
            try {
                var result = await withTimeout(window.supabase.from('messages').insert({ sender_id: state.myId, receiver_id: receiverId, content: content }).select(), 6000, 'insert');
                data = result.data; error = result.error;
            } catch (err) { state.supabaseBlocked = true; }
        }
        if (!data && state.supabaseBlocked) {
            try { data = await restInsert('messages', { sender_id: state.myId, receiver_id: receiverId, content: content }); error = null; }
            catch (err2) { error = err2; }
        }
        if (error) {
            var pendingEl = document.querySelector('[data-msg-id="' + tempId + '"]');
            if (pendingEl) pendingEl.remove();
            if (input) input.value = content;
            alert("Erreur d'envoi : " + error.message);
            state.pendingMessages.delete(tempId);
            return;
        }
        var realMsg = data && data[0];
        if (realMsg) {
            var pendingEl = document.querySelector('[data-msg-id="' + tempId + '"]');
            if (pendingEl) pendingEl.setAttribute('data-msg-id', realMsg.id);
            var cached = state.messageCache.get(receiverId) || [];
            var idx = cached.findIndex(function(m) { return m.id === tempId; });
            if (idx >= 0) cached[idx] = realMsg;
            else cached.push(realMsg);
            state.messageCache.set(receiverId, cached);
        }
        state.pendingMessages.delete(tempId);
    }

    function setupChatRealtime(partnerId) {
        if (state.chatChannel) { state.chatChannel.unsubscribe(); state.chatChannel = null; }
        if (!partnerId || !state.myId) return;
        var channelName = 'widget-chat-' + state.myId + '-' + partnerId;
        state.chatChannel = window.supabase
            .channel(channelName)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'receiver_id=in.(' + state.myId + ',' + partnerId + ')' }, function(payload) {
                var msg = payload.new;
                var relevant = (msg.sender_id === state.myId && msg.receiver_id === partnerId) || (msg.sender_id === partnerId && msg.receiver_id === state.myId);
                if (!relevant || state.pendingMessages.has(msg.id)) return;
                var container = document.getElementById('msg-widget-messages');
                if (container) {
                    if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
                    appendMessage(msg, container);
                }
                var cached = state.messageCache.get(partnerId) || [];
                if (!cached.some(function(m) { return m.id === msg.id; })) { cached.push(msg); state.messageCache.set(partnerId, cached); }
                if (msg.receiver_id === state.myId) {
                    if (state.supabaseBlocked) restRpc('mark_messages_read', { partner: msg.sender_id }).catch(function(){});
                    else window.supabase.rpc('mark_messages_read', { partner: msg.sender_id }).catch(function(){});
                }
            })
            .subscribe(function(){});
    }

    function setupNotifyRealtime() {
        if (state.notifyChannel) { try { state.notifyChannel.unsubscribe(); } catch (e) {} state.notifyChannel = null; }
        if (!state.myId) return;
        var channelName = 'widget-notify-' + state.myId;
        state.notifyChannel = window.supabase
            .channel(channelName)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'receiver_id=eq.' + state.myId }, function(payload) {
                var msg = payload.new;
                var cached = state.messageCache.get(msg.sender_id) || [];
                if (!cached.some(function(m) { return m.id === msg.id; })) { cached.push(msg); state.messageCache.set(msg.sender_id, cached); }
                var isCurrentConv = state.isOpen && (state.isAdmin ? msg.sender_id === state.activePartner : msg.sender_id === state.teacherId);
                if (!isCurrentConv) {
                    updateUnreadBadge();
                    if (Notification.permission === 'granted' && !state.isOpen) {
                        new Notification('Nouveau message', { body: msg.content.substring(0, 60), icon: '💬' });
                    }
                } else {
                    var container = document.getElementById('msg-widget-messages');
                    if (container) {
                        if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
                        appendMessage(msg, container);
                    }
                    if (state.supabaseBlocked) restRpc('mark_messages_read', { partner: msg.sender_id }).catch(function(){});
                    else window.supabase.rpc('mark_messages_read', { partner: msg.sender_id }).catch(function(){});
                }
            })
            .subscribe(function(){});
    }

    async function updateUnreadBadge() {
        var partners = null;
        if (!state.supabaseBlocked) {
            try {
                var result = await withTimeout(window.supabase.rpc('get_conversation_partners'), 6000, 'rpc');
                if (!result.error) partners = result.data;
            } catch (err) { state.supabaseBlocked = true; }
        }
        if (!partners && state.supabaseBlocked) {
            try { partners = await restRpc('get_conversation_partners', {}); }
            catch (err2) { return; }
        }
        if (!partners) return;
        var total = partners.reduce(function(sum, p) { return sum + (p.unread_count || 0); }, 0);
        state.unreadTotal = total;
        var bubble = document.getElementById('msg-widget-bubble');
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
        window.supabase.auth.onAuthStateChange(function(event, session) {
            if (session && session.access_token) state.accessToken = session.access_token;
        });
    }

    async function init() {
        try {
            var result = await waitForSupabase();
            var roleOk = await detectRole(result.client, result.user);
            if (!roleOk) return;
            createWidget();
            if (!state.isAdmin && state.teacherId) setupPresence(state.teacherId);
            await updateUnreadBadge();
            setupNotifyRealtime();
            listenForAuthChanges();
            setInterval(function() { if (!state.isOpen) updateUnreadBadge(); }, 15000);
            if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        } catch (err) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();