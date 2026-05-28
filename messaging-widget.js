// ========== MESSAGING WIDGET — VERSION CORRIGÉE (bug Supabase 2.106.1)
// Fix : timeout forcé + getSession() avant requêtes + fallback fetch

(function() {
    'use strict';

    const DEBUG = true;
    function log(label, data) {
        if (!DEBUG) return;
        const prefix = '[WIDGET-DEBUG ' + new Date().toISOString().substr(11, 8) + '] ' + label;
        if (data !== undefined) {
            console.log(prefix, data);
        } else {
            console.log(prefix);
        }
    }

    // ========== FIX CRITIQUE : Timeout wrapper ==========
    function withTimeout(promise, ms = 8000, label = 'req') {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
        });
        return Promise.race([promise, timeoutPromise]);
    }

    // ========== FIX CRITIQUE : Forcer un getSession() frais ==========
    async function forceFreshSession() {
        try {
            if (!window.supabase?.auth?.getSession) return false;
            const { data, error } = await withTimeout(
                window.supabase.auth.getSession(),
                5000,
                'getSession'
            );
            if (error) {
                log('❌ getSession() a retourné une erreur:', error.message);
                return false;
            }
            log('✅ getSession() frais OK, token valide:', !!data?.session?.access_token);
            return !!data?.session;
        } catch (e) {
            log('❌ getSession() a throw:', e.message);
            return false;
        }
    }

    // ========== FIX CRITIQUE : Fallback fetch direct pour l'INSERT ==========
    async function insertMessageDirect(content, receiverId) {
        log('=== FALLBACK : insertMessageDirect ===');
        try {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Pas de token');

            const url = `${window.YOTEACHER_CONFIG.SUPABASE_URL}/rest/v1/messages`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey': window.YOTEACHER_CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    sender_id: state.myId,
                    receiver_id: receiverId,
                    content: content
                })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            log('✅ Fallback INSERT réussi:', data?.[0]?.id);
            return { data, error: null };
        } catch (err) {
            log('❌ Fallback INSERT échoué:', err.message);
            return { data: null, error: err };
        }
    }

    let state = {
        isOpen: false,
        isAdmin: false,
        myId: null,
        teacherId: null,
        teacherName: null,
        activePartner: null,
        messageCache: new Map(),
        notifyChannel: null,
        chatChannel: null,
        pendingMessages: new Set(),
        supabaseBlocked: false  // Flag pour détecter le blocage
    };

    function escapeHtml(str) {
        return (str || '').replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]));
    }

    function formatTime(iso) {
        return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    // ==========================================
    // ÉTAPE 1 : ATTENTE SUPABASE
    // ==========================================
    async function waitForSupabase() {
        log('=== ÉTAPE 1 : waitForSupabase ===');
        const start = Date.now();
        let attempts = 0;

        while (Date.now() - start < 15000) {
            attempts++;
            log('Tentative ' + attempts + ' — window.supabase existe ?', !!window.supabase);

            if (window.supabase) {
                log('window.supabase existe');
                log('window.supabase.auth existe ?', !!window.supabase.auth);
                log('window.supabase.auth.getUser existe ?', typeof window.supabase.auth?.getUser);

                try {
                    const { data, error } = await window.supabase.auth.getUser();
                    log('getUser() retourné — error:', error);
                    log('getUser() retourné — data.user existe ?', !!data?.user);

                    if (!error && data?.user) {
                        log('✅ Supabase prêt, user.id:', data.user.id);
                        return { client: window.supabase, user: data.user };
                    }
                } catch (e) {
                    log('getUser() a throw:', e.message);
                }
            }
            await new Promise(r => setTimeout(r, 200));
        }
        throw new Error('Supabase timeout après ' + attempts + ' tentatives');
    }

    // ==========================================
    // ÉTAPE 2 : DÉTECTION RÔLE
    // ==========================================
    async function detectRole(client, user) {
        log('=== ÉTAPE 2 : detectRole ===');
        log('user.id:', user.id);
        log('user.email:', user.email);
        state.myId = user.id;

        try {
            const { data: { session } } = await client.auth.getSession();
            log('Session récupérée — token existe ?', !!session?.access_token);

            if (!session?.access_token) {
                log('❌ PAS DE TOKEN');
                return false;
            }

            const url = window.YOTEACHER_CONFIG?.SUPABASE_URL + '/functions/v1/teacher-info';
            log('Appel edge function:', url);

            const res = await fetch(url, {
                headers: { Authorization: 'Bearer ' + session.access_token }
            });

            log('Réponse edge function — status:', res.status);
            log('Réponse edge function — ok:', res.ok);

            if (!res.ok) {
                log('❌ Edge function a échoué');
                return false;
            }

            const teacher = await res.json();
            log('Edge function retourné:', JSON.stringify(teacher));

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
            log('❌ detectRole a throw:', err.message);
            log('Stack:', err.stack);
            return false;
        }
    }

    // ==========================================
    // ÉTAPE 3 : CRÉATION DOM
    // ==========================================
    function createWidget() {
        log('=== ÉTAPE 3 : createWidget ===');
        if (document.getElementById('messaging-widget-root')) {
            log('Widget DOM existe déjà');
            return;
        }
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
        log('state.isOpen avant:', state.isOpen);
        const win = document.getElementById('msg-widget-window');
        if (!win) { log('❌ Fenêtre DOM non trouvée'); return; }

        if (state.isOpen) {
            log('Fermeture fenêtre');
            win.classList.add('closing');
            setTimeout(() => {
                win.style.display = 'none';
                win.classList.remove('closing');
                state.isOpen = false;
                state.activePartner = null;
                if (state.chatChannel) {
                    log('Unsubscribe chatChannel');
                    state.chatChannel.unsubscribe();
                    state.chatChannel = null;
                }
                log('✅ Fenêtre fermée');
            }, 250);
        } else {
            log('Ouverture fenêtre');
            state.isOpen = true;
            win.style.display = 'flex';
            if (state.isAdmin) {
                log('Rendu ADMIN');
                renderAdminConversations();
            } else {
                log('Rendu ÉTUDIANT');
                renderStudentChat();
            }
        }
    }

    function closeWindow() {
        if (state.isOpen) toggleWindow();
    }

    // ==========================================
    // ÉTAPE 4 : RENDU ÉTUDIANT
    // ==========================================
    async function renderStudentChat() {
        log('=== ÉTAPE 4 : renderStudentChat ===');
        log('teacherId:', state.teacherId);

        const win = document.getElementById('msg-widget-window');
        if (!win) { log('❌ win null'); return; }
        if (!state.teacherId) { log('❌ teacherId null'); return; }

        const cached = state.messageCache.get(state.teacherId);
        log('Cache pour teacherId:', cached ? cached.length + ' messages' : 'VIDE');

        win.innerHTML = `
            <div class="messaging-widget-header">
                <div class="messaging-widget-header-info">
                    <div class="messaging-widget-avatar">👨‍🏫</div>
                    <div class="messaging-widget-header-text">
                        <div class="messaging-widget-header-name">${escapeHtml(state.teacherName || 'Professeur')}</div>
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
        log('Container messages:', !!container);

        if (cached && cached.length > 0) {
            log('Affichage depuis cache');
            renderMessagesToContainer(cached, container);
        } else {
            log('Aucun cache, affichage état vide');
            container.innerHTML = `
                <div class="messaging-widget-empty">
                    <i class="fas fa-comment-slash"></i>
                    <p>Aucun message encore.<br>Commencez la conversation !</p>
                </div>
            `;
        }

        log('Appel loadMessages...');
        await loadMessages(state.teacherId);
        log('Appel setupChatRealtime...');
        setupChatRealtime(state.teacherId);
    }

    // ==========================================
    // ÉTAPE 5 : RENDU ADMIN - LISTE
    // ==========================================
    async function renderAdminConversations() {
        log('=== ÉTAPE 5 : renderAdminConversations ===');
        const win = document.getElementById('msg-widget-window');
        if (!win) { log('❌ win null'); return; }

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
        log('partnerId:', partnerId);
        log('partnerName:', partnerName);

        const win = document.getElementById('msg-widget-window');
        if (!win) { log('❌ win null'); return; }
        state.activePartner = partnerId;
        const cached = state.messageCache.get(partnerId);
        log('Cache pour partnerId:', cached ? cached.length + ' messages' : 'VIDE');

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
            log('Clic retour');
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
    // ÉTAPE 7 : CHARGEMENT MESSAGES (avec timeout fix)
    // ==========================================
    async function loadMessages(partnerId) {
        log('=== ÉTAPE 7 : loadMessages ===');
        log('partnerId:', partnerId);
        log('myId:', state.myId);

        const container = document.getElementById('msg-widget-messages');
        log('Container existe ?', !!container);
        if (!container) { log('❌ Container null'); return; }

        try {
            // FIX : Forcer un getSession() frais avant la requête
            await forceFreshSession();

            log('Appel RPC get_messages_with...');
            const { data: msgs, error } = await withTimeout(
                window.supabase.rpc('get_messages_with', { partner: partnerId }),
                10000,
                'rpc-get_messages_with'
            );

            log('RPC retourné — error:', error);
            log('RPC retourné — data:', msgs ? msgs.length + ' messages' : 'null');

            if (error) {
                log('❌ RPC a retourné une erreur:', error.message);
                throw error;
            }

            if (msgs) {
                log('Mise en cache de', msgs.length, 'messages');
                state.messageCache.set(partnerId, msgs);
            }

            log('Rendu des messages dans le DOM...');
            renderMessagesToContainer(msgs, container);
            container.scrollTop = container.scrollHeight;

            log('Appel mark_messages_read...');
            const { error: readError } = await withTimeout(
                window.supabase.rpc('mark_messages_read', { partner: partnerId }),
                8000,
                'rpc-mark_messages_read'
            );
            log('mark_messages_read — error:', readError);

        } catch (err) {
            log('❌ loadMessages a throw:', err.message);
            log('Stack:', err.stack);
            // Si timeout, marquer Supabase comme potentiellement bloqué
            if (err.message.includes('timeout')) {
                state.supabaseBlocked = true;
                log('⚠️ Supabase marqué comme bloqué');
            }
        }
    }

    // ==========================================
    // ÉTAPE 8 : CHARGEMENT CONVERSATIONS ADMIN
    // ==========================================
    async function loadAdminConversations() {
        log('=== ÉTAPE 8 : loadAdminConversations ===');
        const container = document.getElementById('msg-widget-conversations');
        log('Container existe ?', !!container);
        if (!container) { log('❌ Container null'); return; }

        try {
            await forceFreshSession();

            log('Appel RPC get_conversation_partners...');
            const { data: partners, error } = await withTimeout(
                window.supabase.rpc('get_conversation_partners'),
                10000,
                'rpc-get_conversation_partners'
            );

            log('RPC retourné — error:', error);
            log('RPC retourné — data:', partners ? partners.length + ' conversations' : 'null');

            if (error) {
                log('❌ RPC a retourné une erreur:', error.message);
                throw error;
            }

            state.conversations = partners || [];
            container.innerHTML = '';

            if (!partners || partners.length === 0) {
                log('Aucune conversation');
                container.innerHTML = `
                    <div class="messaging-widget-empty">
                        <i class="fas fa-inbox"></i>
                        <p>Aucune conversation pour le moment</p>
                    </div>
                `;
                return;
            }

            log('Rendu de', partners.length, 'conversations');
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

        } catch (err) {
            log('❌ loadAdminConversations a throw:', err.message);
            log('Stack:', err.stack);
            container.innerHTML = `<div class="messaging-widget-empty"><p>Erreur: ${err.message}</p></div>`;
        }
    }

    function renderMessagesToContainer(msgs, container) {
        log('=== renderMessagesToContainer ===');
        log('msgs:', msgs ? msgs.length : 'null');
        log('container:', !!container);

        if (!msgs || msgs.length === 0) {
            log('Aucun message à rendre');
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
        msgs.forEach((m, i) => {
            log('Rendu message', i, ':', m.id, m.content.substring(0, 30));
            appendMessage(m, container);
        });
    }

    function appendMessage(msg, container) {
        const existing = container.querySelector(`[data-msg-id="${msg.id}"]`);
        if (existing) {
            log('Message déjà dans DOM, ignoré:', msg.id);
            return;
        }

        const isMe = msg.sender_id === state.myId;
        const div = document.createElement('div');
        div.className = `messaging-widget-msg ${isMe ? 'sent' : 'received'}`;
        div.setAttribute('data-msg-id', msg.id || 'pending-' + Date.now());
        div.innerHTML = `${escapeHtml(msg.content)}<span class="messaging-widget-msg-time">${formatTime(msg.created_at)}</span>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // ==========================================
    // ÉTAPE 9 : ENVOI (avec timeout fix + fallback)
    // ==========================================
    async function sendMessage() {
        log('=== ÉTAPE 9 : sendMessage ===');
        const input = document.getElementById('msg-widget-input');
        const content = input?.value.trim();
        log('content:', content);
        if (!content) { log('❌ Content vide'); return; }

        const receiverId = state.isAdmin ? state.activePartner : state.teacherId;
        log('receiverId:', receiverId);
        log('isAdmin:', state.isAdmin);
        log('activePartner:', state.activePartner);
        log('teacherId:', state.teacherId);

        if (!receiverId) { log('❌ receiverId null'); return; }
        if (input) input.value = '';

        const tempId = 'pending-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        state.pendingMessages.add(tempId);
        log('tempId:', tempId);

        // Optimistic UI
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
            log('Message optimiste affiché');
        }

        try {
            // FIX : Forcer un getSession() frais avant l'INSERT
            await forceFreshSession();

            log('INSERT dans messages...');
            log('sender_id:', state.myId);
            log('receiver_id:', receiverId);

            let data, error;

            // Si Supabase a déjà été bloqué, utiliser directement le fallback
            if (state.supabaseBlocked) {
                log('⚠️ Supabase était bloqué, utilisation du fallback direct');
                const fallback = await insertMessageDirect(content, receiverId);
                data = fallback.data;
                error = fallback.error;
            } else {
                // Essai normal avec timeout
                const result = await withTimeout(
                    window.supabase.from('messages').insert({
                        sender_id: state.myId,
                        receiver_id: receiverId,
                        content: content
                    }).select(),
                    10000,
                    'insert-msg'
                );
                data = result.data;
                error = result.error;

                // Si timeout, essayer le fallback
                if (!data && !error) {
                    log('⚠️ INSERT a timeout, tentative fallback...');
                    state.supabaseBlocked = true;
                    const fallback = await insertMessageDirect(content, receiverId);
                    data = fallback.data;
                    error = fallback.error;
                }
            }

            log('INSERT retourné — error:', error);
            log('INSERT retourné — data:', data ? JSON.stringify(data) : 'null');

            if (error) {
                log('❌ INSERT a échoué:', error.message);
                throw error;
            }

            const realMsg = data?.[0];
            if (realMsg) {
                log('Message réel reçu, id:', realMsg.id);
                const pendingEl = document.querySelector(`[data-msg-id="${tempId}"]`);
                if (pendingEl) {
                    pendingEl.setAttribute('data-msg-id', realMsg.id);
                    log('ID temporaire remplacé par réel');
                }
                const cached = state.messageCache.get(receiverId) || [];
                const idx = cached.findIndex(m => m.id === tempId);
                if (idx >= 0) cached[idx] = realMsg;
                else cached.push(realMsg);
                state.messageCache.set(receiverId, cached);
                log('Cache mis à jour');
            } else {
                log('❌ INSERT a retourné data vide !');
            }

            state.pendingMessages.delete(tempId);
            log('✅ Envoi terminé avec succès');

        } catch (err) {
            log('❌ sendMessage a throw:', err.message);
            log('Stack:', err.stack);
            state.pendingMessages.delete(tempId);
            if (input) input.value = content; // Restore le texte
            alert("Erreur d'envoi : " + err.message);
        }
    }

    // ==========================================
    // ÉTAPE 10 : REALTIME CHAT
    // ==========================================
    function setupChatRealtime(partnerId) {
        log('=== ÉTAPE 10 : setupChatRealtime ===');
        log('partnerId:', partnerId);

        if (state.chatChannel) {
            log('Unsubscribe ancien chatChannel');
            state.chatChannel.unsubscribe();
            state.chatChannel = null;
        }
        if (!partnerId || !state.myId) {
            log('❌ partnerId ou myId null');
            return;
        }

        const channelName = 'widget-chat-' + state.myId + '-' + partnerId;
        log('Nom canal:', channelName);

        state.chatChannel = window.supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=in.(${state.myId},${partnerId})`
            }, (payload) => {
                log('=== Chat realtime event ===');
                log('payload.new:', JSON.stringify(payload.new));

                const msg = payload.new;
                const relevant =
                    (msg.sender_id === state.myId && msg.receiver_id === partnerId) ||
                    (msg.sender_id === partnerId && msg.receiver_id === state.myId);
                log('relevant:', relevant);

                if (!relevant) { log('Message non pertinent, ignoré'); return; }
                if (state.pendingMessages.has(msg.id)) { log('Message pending, ignoré'); return; }

                const container = document.getElementById('msg-widget-messages');
                log('Container existe ?', !!container);
                if (container) {
                    if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
                    appendMessage(msg, container);
                    log('Message ajouté au DOM');
                }

                const cached = state.messageCache.get(partnerId) || [];
                const alreadyInCache = cached.some(m => m.id === msg.id);
                if (!alreadyInCache) {
                    cached.push(msg);
                    state.messageCache.set(partnerId, cached);
                    log('Message ajouté au cache');
                }

                if (msg.receiver_id === state.myId) {
                    log('Marquage comme lu...');
                    window.supabase.rpc('mark_messages_read', { partner: msg.sender_id });
                }
            })
            .subscribe((status) => {
                log('Chat channel status:', status);
            });
    }

    // ==========================================
    // ÉTAPE 11 : REALTIME NOTIFY
    // ==========================================
    function setupNotifyRealtime() {
        log('=== ÉTAPE 11 : setupNotifyRealtime ===');
        log('myId:', state.myId);

        if (state.notifyChannel) {
            log('Unsubscribe ancien notifyChannel');
            try { state.notifyChannel.unsubscribe(); } catch (e) {}
            state.notifyChannel = null;
        }
        if (!state.myId) {
            log('❌ myId null, pas de canal');
            return;
        }

        const channelName = 'widget-notify-' + state.myId;
        log('Nom canal:', channelName);
        log('Filter: receiver_id=eq.' + state.myId);

        state.notifyChannel = window.supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${state.myId}`
            }, (payload) => {
                log('=== NOTIFY realtime event ===');
                log('payload.new:', JSON.stringify(payload.new));

                const msg = payload.new;
                log('Message reçu de:', msg.sender_id);
                log('Mon ID:', state.myId);
                log('isAdmin:', state.isAdmin);
                log('isOpen:', state.isOpen);
                log('activePartner:', state.activePartner);
                log('teacherId:', state.teacherId);

                // Mise à jour cache
                const cached = state.messageCache.get(msg.sender_id) || [];
                const alreadyInCache = cached.some(m => m.id === msg.id);
                if (!alreadyInCache) {
                    cached.push(msg);
                    state.messageCache.set(msg.sender_id, cached);
                    log('Message ajouté au cache');
                } else {
                    log('Message déjà dans cache');
                }

                // Déterminer si c'est la conversation active
                const isCurrentConv = state.isOpen && (
                    state.isAdmin
                        ? msg.sender_id === state.activePartner
                        : msg.sender_id === state.teacherId
                );
                log('isCurrentConv:', isCurrentConv);

                if (!isCurrentConv) {
                    log('Conversation inactive, mise à jour badge');
                    updateUnreadBadge();
                    if (Notification.permission === 'granted' && !state.isOpen) {
                        new Notification('Nouveau message', {
                            body: msg.content.substring(0, 60),
                            icon: '💬'
                        });
                    }
                } else {
                    log('Conversation active, affichage direct');
                    const container = document.getElementById('msg-widget-messages');
                    if (container) {
                        if (container.querySelector('.messaging-widget-empty')) container.innerHTML = '';
                        appendMessage(msg, container);
                    }
                    window.supabase.rpc('mark_messages_read', { partner: msg.sender_id });
                }
            })
            .subscribe((status) => {
                log('Notify channel status:', status);
            });
    }

    // ==========================================
    // ÉTAPE 12 : BADGE
    // ==========================================
    async function updateUnreadBadge() {
        log('=== ÉTAPE 12 : updateUnreadBadge ===');
        try {
            await forceFreshSession();

            log('Appel RPC get_conversation_partners...');
            const { data: partners, error } = await withTimeout(
                window.supabase.rpc('get_conversation_partners'),
                10000,
                'rpc-badge'
            );
            log('RPC retourné — error:', error);
            log('RPC retourné — data:', partners ? partners.length + ' conversations' : 'null');

            if (error) {
                log('❌ RPC a retourné une erreur:', error.message);
                throw error;
            }

            const total = (partners || []).reduce((sum, p) => sum + (p.unread_count || 0), 0);
            log('Total non-lus:', total);
            state.unreadTotal = total;

            const bubble = document.getElementById('msg-widget-bubble');
            log('Bubble existe ?', !!bubble);
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
        } catch (err) {
            log('❌ updateUnreadBadge a throw:', err.message);
        }
    }

    // ==========================================
    // ÉTAPE 13 : AUTH CHANGES
    // ==========================================
    function listenForAuthChanges() {
        log('=== ÉTAPE 13 : listenForAuthChanges ===');
        if (!window.supabase) { log('❌ window.supabase null'); return; }

        window.supabase.auth.onAuthStateChange((event, session) => {
            log('Auth event:', event);
            log('Session existe ?', !!session);

            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                log('SIGNED_IN/TOKEN_REFRESHED détecté');
                // FIX : Réinitialiser le flag de blocage après un refresh réussi
                state.supabaseBlocked = false;
                log('🔄 Flag supabaseBlocked réinitialisé');
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
            log('Attente Supabase...');
            const { client, user } = await waitForSupabase();
            log('Supabase prêt, user:', user.email);

            log('Détection rôle...');
            const roleOk = await detectRole(client, user);
            log('detectRole retourné:', roleOk);

            if (!roleOk) {
                log('❌ Rôle non détecté, arrêt');
                return;
            }

            log('Création DOM...');
            createWidget();

            log('Mise à jour badge initiale...');
            await updateUnreadBadge();

            log('Setup notify realtime...');
            setupNotifyRealtime();

            log('Setup auth listener...');
            listenForAuthChanges();

            log('Setup polling badge...');
            setInterval(() => {
                if (!state.isOpen) {
                    log('Polling badge (fenêtre fermée)');
                    updateUnreadBadge();
                }
            }, 15000);

            if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission();
            }

            log('✅ WIDGET INITIALISÉ');
            log('========================================');

        } catch (err) {
            log('❌ Init failed:', err.message);
            log('Stack:', err.stack);
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