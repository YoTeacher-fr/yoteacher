// ========== MESSAGING WIDGET v4 ==========
// Correction : pas de boucle infinie de reconnexion, gestion propre des canaux,
//              vérification DOM avant écriture, badge fiable

(function() {
    'use strict';

    const CONFIG = {
        maxWaitMs: 15000,
        checkIntervalMs: 200,
        badgePollMs: 15000,
        reconnectMs: 5000,        // Délai augmenté pour éviter les boucles
        rpcRetryMs: 2000,
        rpcMaxRetries: 3
    };

    let state = {
        isOpen: false,
        isAdmin: false,
        myId: null,
        teacherId: null,
        teacherName: null,
        activePartner: null,
        conversations: [],
        chatChannel: null,
        notifyChannel: null,
        unreadTotal: 0,
        initialized: false,
        messageCache: new Map(),
        pendingMessages: new Set(),
        isReconnecting: false     // ← VERROU : empêche les reconnexions simultanées
    };

    function escapeHtml(str) {
        return (str || '').replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]));
    }

    function formatTime(iso) {
        return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    function formatDateShort(iso) {
        return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }

    // ==========================================
    // ATTENTE SUPABASE
    // ==========================================
    async function waitForSupabase() {
        const start = Date.now();
        while (Date.now() - start < CONFIG.maxWaitMs) {
            if (window.supabase && typeof window.supabase.auth?.getUser === 'function') {
                try {
                    const { data, error } = await window.supabase.auth.getUser();
                    if (!error && data?.user) {
                        return { client: window.supabase, user: data.user };
                    }
                } catch (e) {}
            }
            await new Promise(r => setTimeout(r, CONFIG.checkIntervalMs));
        }
        throw new Error('Supabase timeout');
    }

    // ==========================================
    // RPC AVEC RETRY
    // ==========================================
    async function rpcWithRetry(fnName, params, retries = CONFIG.rpcMaxRetries) {
        for (let i = 0; i < retries; i++) {
            try {
                const { data, error } = await window.supabase.rpc(fnName, params);
                if (error) throw error;
                return { data, error: null };
            } catch (err) {
                if (i === retries - 1) throw err;
                console.log(`[WIDGET] RPC ${fnName} retry ${i+1}/${retries}...`);
                await new Promise(r => setTimeout(r, CONFIG.rpcRetryMs));
            }
        }
    }

    // ==========================================
    // DOM
    // ==========================================
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
                win.style.display = 'none';
                win.classList.remove('closing');
                state.isOpen = false;
                state.activePartner = null;
                if (state.chatChannel) {
                    state.chatChannel.unsubscribe();
                    state.chatChannel = null;
                }
            }, 250);
        } else {
            state.isOpen = true;
            win.style.display = 'flex';
            if (state.isAdmin) {
                renderAdminConversations();
            } else {
                renderStudentChat();
            }
        }
    }

    function closeWindow() {
        if (state.isOpen) toggleWindow();
    }

    // ==========================================
    // RENDU ÉTUDIANT
    // ==========================================
    async function renderStudentChat() {
        const win = document.getElementById('msg-widget-window');
        if (!win || !state.teacherId) return;

        const teacherName = state.teacherName || 'Professeur';
        const cached = state.messageCache.get(state.teacherId);

        win.innerHTML = `
            <div class="messaging-widget-header">
                <div class="messaging-widget-header-info">
                    <div class="messaging-widget-avatar">👨‍🏫</div>
                    <div class="messaging-widget-header-text">
                        <div class="messaging-widget-header-name">${escapeHtml(teacherName)}</div>
                        <div class="messaging-widget-header-status"><span class="messaging-widget-status-dot"></span>En ligne</div>
                    </div>
                </div>
                <button class="messaging-widget-close" id="msg-widget-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="messaging-widget-messages" id="msg-widget-messages"></div>
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
            container.innerHTML = `
                <div class="messaging-widget-empty">
                    <i class="fas fa-comment-slash"></i>
                    <p>Aucun message encore.<br>Commencez la conversation !</p>
                </div>
            `;
        }

        await loadMessages(state.teacherId);
        setupChatRealtime(state.teacherId);
    }

    // ==========================================
    // RENDU ADMIN - LISTE
    // ==========================================
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

    // ==========================================
    // RENDU ADMIN - CHAT
    // ==========================================
    async function renderAdminChat(partnerId, partnerName) {
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
                        <div class="messaging-widget-header-status"><span class="messaging-widget-status-dot"></span>Conversation privée</div>
                    </div>
                </div>
                <button class="messaging-widget-close" id="msg-widget-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="messaging-widget-messages" id="msg-widget-messages"></div>
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
        if (cached && cached.length > 0) {
            renderMessagesToContainer(cached, container);
        } else {
            container.innerHTML = `
                <div class="messaging-widget-empty">
                    <i class="fas fa-comment-slash"></i>
                    <p>Aucun message encore.<br>Commencez la conversation !</p>
                </div>
            `;
        }

        await loadMessages(partnerId);
        setupChatRealtime(partnerId);
    }

    // ==========================================
    // CHARGEMENT MESSAGES
    // ==========================================
    async function loadMessages(partnerId) {
        const container = document.getElementById('msg-widget-messages');
        if (!container) return;

        try {
            const { data: msgs } = await rpcWithRetry('get_messages_with', { partner: partnerId });

            if (msgs) state.messageCache.set(partnerId, msgs);
            renderMessagesToContainer(msgs, container);
            container.scrollTop = container.scrollHeight;

            await rpcWithRetry('mark_messages_read', { partner: partnerId });
            updateUnreadBadge();
        } catch (err) {
            console.error('[WIDGET] loadMessages error:', err);
            const cached = state.messageCache.get(partnerId);
            if (cached && cached.length > 0) {
                renderMessagesToContainer(cached, container);
            } else {
                container.innerHTML = `<div class="messaging-widget-empty"><p>Erreur de connexion. <button onclick="this.closest('.messaging-widget-window').querySelector('.messaging-widget-back')?.click()">Retour</button></p></div>`;
            }
        }
    }

    // ==========================================
    // CHARGEMENT CONVERSATIONS ADMIN
    // ==========================================
    async function loadAdminConversations() {
        const container = document.getElementById('msg-widget-conversations');
        if (!container) return;

        try {
            const { data: partners } = await rpcWithRetry('get_conversation_partners');

            state.conversations = partners || [];
            container.innerHTML = '';

            if (!partners || partners.length === 0) {
                container.innerHTML = `
                    <div class="messaging-widget-empty">
                        <i class="fas fa-inbox"></i>
                        <p>Aucune conversation pour le moment</p>
                    </div>
                `;
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

            updateUnreadBadge();
        } catch (err) {
            console.error('[WIDGET] loadAdminConversations error:', err);
            container.innerHTML = `<div class="messaging-widget-empty"><p>Erreur de connexion. <button onclick="window.location.reload()">Rafraîchir la page</button></p></div>`;
        }
    }

    function renderMessagesToContainer(msgs, container) {
        if (!msgs || msgs.length === 0) {
            if (!container.querySelector('.messaging-widget-msg')) {
                container.innerHTML = `
                    <div class="messaging-widget-empty">
                        <i class="fas fa-comment-slash"></i>
                        <p>Aucun message encore.<br>Commencez la conversation !</p>
                    </div>
                `;
            }
            return;
        }
        container.innerHTML = '';
        msgs.forEach(m => appendMessage(m, container));
    }

    // ==========================================
    // AJOUT MESSAGE AU DOM (dédoublonnage)
    // ==========================================
    function appendMessage(msg, container) {
        const existing = container.querySelector(`[data-msg-id="${msg.id}"]`);
        if (existing) return;

        const isMe = msg.sender_id === state.myId;
        const div = document.createElement('div');
        div.className = `messaging-widget-msg ${isMe ? 'sent' : 'received'}`;
        div.setAttribute('data-msg-id', msg.id || 'pending-' + Date.now());
        div.innerHTML = `${escapeHtml(msg.content)}<span class="messaging-widget-msg-time">${formatTime(msg.created_at)}</span>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // ==========================================
    // ENVOI
    // ==========================================
    async function sendMessage() {
        const input = document.getElementById('msg-widget-input');
        const content = input?.value.trim();
        if (!content) return;

        const receiverId = state.isAdmin ? state.activePartner : state.teacherId;
        if (!receiverId) return;

        if (input) input.value = '';

        const tempId = 'pending-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        state.pendingMessages.add(tempId);

        const container = document.getElementById('msg-widget-messages');
        if (container) {
            if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
            const optimisticMsg = {
                id: tempId,
                sender_id: state.myId,
                receiver_id: receiverId,
                content: content,
                created_at: new Date().toISOString()
            };
            appendMessage(optimisticMsg, container);
        }

        try {
            const { data, error } = await window.supabase.from('messages').insert({
                sender_id: state.myId,
                receiver_id: receiverId,
                content: content
            }).select();

            if (error) throw error;

            const realMsg = data?.[0];
            if (realMsg) {
                const pendingEl = document.querySelector(`[data-msg-id="${tempId}"]`);
                if (pendingEl) {
                    pendingEl.setAttribute('data-msg-id', realMsg.id);
                }
                const cached = state.messageCache.get(receiverId) || [];
                const idx = cached.findIndex(m => m.id === tempId);
                if (idx >= 0) cached[idx] = realMsg;
                else cached.push(realMsg);
                state.messageCache.set(receiverId, cached);
            }

            state.pendingMessages.delete(tempId);
        } catch (err) {
            console.error('[WIDGET] Erreur envoi:', err);
            state.pendingMessages.delete(tempId);
            if (input) input.value = content;
            alert("Erreur d'envoi : " + err.message);
        }
    }

    // ==========================================
    // REALTIME : CANAL CONVERSATION
    // ==========================================
    function setupChatRealtime(partnerId) {
        if (state.chatChannel) {
            state.chatChannel.unsubscribe();
            state.chatChannel = null;
        }
        if (!partnerId || !state.myId) return;

        state.chatChannel = window.supabase
            .channel('widget-chat-' + state.myId + '-' + partnerId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=in.(${state.myId},${partnerId})`
            }, (payload) => {
                const msg = payload.new;
                const relevant =
                    (msg.sender_id === state.myId && msg.receiver_id === partnerId) ||
                    (msg.sender_id === partnerId && msg.receiver_id === state.myId);
                if (!relevant) return;
                if (state.pendingMessages.has(msg.id)) return;

                const container = document.getElementById('msg-widget-messages');
                if (container) {
                    if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
                    appendMessage(msg, container);
                }

                const cached = state.messageCache.get(partnerId) || [];
                const alreadyInCache = cached.some(m => m.id === msg.id);
                if (!alreadyInCache) {
                    cached.push(msg);
                    state.messageCache.set(partnerId, cached);
                }

                if (msg.receiver_id === state.myId) {
                    window.supabase.rpc('mark_messages_read', { partner: msg.sender_id });
                }
            })
            .subscribe((status) => {
                console.log('[WIDGET] Chat channel status:', status);
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setTimeout(() => setupChatRealtime(partnerId), CONFIG.reconnectMs);
                }
                // CLOSED = fermé proprement (pas de reconnexion auto, c'est volontaire)
            });
    }

    // ==========================================
    // REALTIME : CANAL NOTIFICATION (toujours actif)
    // ==========================================
    function setupNotifyRealtime() {
        // VERROU : si une reconnexion est déjà en cours, ignorer
        if (state.isReconnecting) {
            console.log('[WIDGET] Reconnexion déjà en cours, ignorée');
            return;
        }

        // Nettoyage propre de l'ancien canal
        if (state.notifyChannel) {
            try {
                state.notifyChannel.unsubscribe();
            } catch (e) {}
            state.notifyChannel = null;
        }

        if (!state.myId) return;

        state.notifyChannel = window.supabase
            .channel('widget-notify-' + state.myId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${state.myId}`
            }, (payload) => {
                const msg = payload.new;
                console.log('[WIDGET] Notify reçu de:', msg.sender_id);

                const cached = state.messageCache.get(msg.sender_id) || [];
                const alreadyInCache = cached.some(m => m.id === msg.id);
                if (!alreadyInCache) {
                    cached.push(msg);
                    state.messageCache.set(msg.sender_id, cached);
                }

                const isCurrentConv = state.isOpen && (
                    state.isAdmin
                        ? msg.sender_id === state.activePartner
                        : msg.sender_id === state.teacherId
                );

                if (!isCurrentConv) {
                    updateUnreadBadge();
                    if (Notification.permission === 'granted' && !state.isOpen) {
                        new Notification('Nouveau message', {
                            body: msg.content.substring(0, 60),
                            icon: '💬'
                        });
                    }
                } else {
                    const container = document.getElementById('msg-widget-messages');
                    if (container) {
                        if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
                        appendMessage(msg, container);
                    }
                    window.supabase.rpc('mark_messages_read', { partner: msg.sender_id });
                }
            })
            .subscribe((status) => {
                console.log('[WIDGET] Notify channel status:', status);

                // Seuls CHANNEL_ERROR et TIMED_OUT méritent une reconnexion
                // CLOSED = fermé volontairement ou par Supabase lors d'un refresh
                // On ne reconnecte PAS immédiatement sur CLOSED pour éviter la boucle
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.log('[WIDGET] Erreur canal, reconnexion dans', CONFIG.reconnectMs, 'ms');
                    state.isReconnecting = true;
                    setTimeout(() => {
                        state.isReconnecting = false;
                        setupNotifyRealtime();
                    }, CONFIG.reconnectMs);
                }
                // Sur CLOSED : on laisse le polling badgePollMs s'en occuper
                // ou l'événement SIGNED_IN déclenchera une reconnexion propre
            });
    }

    // ==========================================
    // BADGE
    // ==========================================
    async function updateUnreadBadge() {
        try {
            const { data: partners } = await rpcWithRetry('get_conversation_partners');
            const total = (partners || []).reduce((sum, p) => sum + (p.unread_count || 0), 0);
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
        } catch (err) {
            console.error('[WIDGET] Badge error:', err);
        }
    }

    // ==========================================
    // DÉTECTION RÔLE
    // ==========================================
    async function detectRole(client, user) {
        try {
            state.myId = user.id;

            const { data: { session } } = await client.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Pas de token');

            const res = await fetch(`${window.YOTEACHER_CONFIG.SUPABASE_URL}/functions/v1/teacher-info`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                if (res.status === 404) {
                    console.warn('[WIDGET] Edge function teacher-info non déployée');
                    return false;
                }
                throw new Error('teacher-info: ' + res.status);
            }

            const teacher = await res.json();

            if (teacher.id === user.id) {
                state.isAdmin = true;
                state.teacherId = user.id;
                console.log('[WIDGET] Mode ADMIN');
            } else {
                state.teacherId = teacher.id;
                state.teacherName = teacher.full_name;
                state.isAdmin = false;
                console.log('[WIDGET] Mode ÉTUDIANT, prof:', teacher.full_name);
            }
            return true;
        } catch (err) {
            console.error('[WIDGET] detectRole error:', err);
            return false;
        }
    }

    // ==========================================
    // GESTION AUTH CHANGES (SIGNED_IN)
    // ==========================================
    function listenForAuthChanges() {
        if (!window.supabase) return;

        window.supabase.auth.onAuthStateChange((event, session) => {
            console.log('[WIDGET] Auth event:', event);

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                // Attendre que Supabase stabilise la session avant de reconnecter
                setTimeout(() => {
                    if (!state.isReconnecting) {
                        console.log('[WIDGET] Reconnexion post-auth...');
                        setupNotifyRealtime();
                    }
                }, 1000);
            }
        });
    }

    // ==========================================
    // INITIALISATION
    // ==========================================
    async function init() {
        console.log('🚀 [WIDGET] Démarrage...');

        try {
            const { client, user } = await waitForSupabase();
            const roleOk = await detectRole(client, user);
            if (!roleOk) {
                console.log('[WIDGET] Rôle non détecté');
                return;
            }

            createWidget();
            await updateUnreadBadge();
            setupNotifyRealtime();
            listenForAuthChanges();

            // Polling de secours pour le badge (même si Realtime est down)
            setInterval(() => {
                if (!state.isOpen) updateUnreadBadge();
            }, CONFIG.badgePollMs);

            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }

            state.initialized = true;
            console.log('✅ [WIDGET] Initialisé');

        } catch (err) {
            console.error('❌ [WIDGET] Init failed:', err.message);
        }
    }

    // ==========================================
    // LANCEMENT
    // ==========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
