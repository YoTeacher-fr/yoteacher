// ========== MESSAGING WIDGET ==========
// Widget flottant de messagerie — bulle fixe en bas à droite
// Usage : inclure messaging-widget.css + messaging-widget.js sur n'importe quelle page
// Le widget détecte automatiquement si l'utilisateur est admin ou étudiant

(function() {
    'use strict';

    // ==========================================
    // CONFIGURATION
    // ==========================================
    const WIDGET_CONFIG = {
        position: { bottom: 24, right: 24 },
        colors: {
            primary: '#2c3e50',
            accent: '#3c84f6',
            sent: '#2c3e50',
            received: '#ffffff'
        }
    };

    // ==========================================
    // ÉTAT
    // ==========================================
    let state = {
        isOpen: false,
        isAdmin: false,
        myId: null,
        teacherId: null,
        activePartner: null,
        conversations: [],
        channel: null,
        unreadTotal: 0
    };

    // ==========================================
    // UTILITAIRES
    // ==========================================
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
    // DOM : CRÉATION DU WIDGET
    // ==========================================
    function createWidget() {
        // Vérifier si déjà présent
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

    // ==========================================
    // TOGGLE OUVERTURE/FERMETURE
    // ==========================================
    function toggleWindow() {
        const win = document.getElementById('msg-widget-window');
        if (!win) return;

        if (state.isOpen) {
            win.classList.add('closing');
            setTimeout(() => {
                win.style.display = 'none';
                win.classList.remove('closing');
                state.isOpen = false;
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
    // RENDU : ÉTUDIANT (chat direct avec prof)
    // ==========================================
    async function renderStudentChat() {
        const win = document.getElementById('msg-widget-window');
        if (!win || !state.teacherId) return;

        const teacherName = state.teacherName || 'Professeur';

        win.innerHTML = `
            <div class="messaging-widget-header">
                <div class="messaging-widget-header-info">
                    <div class="messaging-widget-avatar">👨‍🏫</div>
                    <div class="messaging-widget-header-text">
                        <div class="messaging-widget-header-name">${escapeHtml(teacherName)}</div>
                        <div class="messaging-widget-header-status">
                            <span class="messaging-widget-status-dot"></span>
                            En ligne
                        </div>
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
        document.getElementById('msg-widget-send').addEventListener('click', () => sendMessage());
        document.getElementById('msg-widget-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        await loadMessages(state.teacherId);
        setupRealtime();
    }

    // ==========================================
    // RENDU : ADMIN (liste des conversations)
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
                <div class="messaging-widget-empty">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Chargement...</p>
                </div>
            </div>
        `;

        document.getElementById('msg-widget-close').addEventListener('click', closeWindow);
        await loadAdminConversations();
    }

    // ==========================================
    // RENDU : ADMIN (chat individuel)
    // ==========================================
    async function renderAdminChat(partnerId, partnerName) {
        const win = document.getElementById('msg-widget-window');
        if (!win) return;

        state.activePartner = partnerId;

        win.innerHTML = `
            <div class="messaging-widget-header">
                <button class="messaging-widget-back" id="msg-widget-back"><i class="fas fa-arrow-left"></i></button>
                <div class="messaging-widget-header-info">
                    <div class="messaging-widget-avatar">🎓</div>
                    <div class="messaging-widget-header-text">
                        <div class="messaging-widget-header-name">${escapeHtml(partnerName || 'Étudiant')}</div>
                        <div class="messaging-widget-header-status">
                            <span class="messaging-widget-status-dot"></span>
                            Conversation privée
                        </div>
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
            renderAdminConversations();
        });
        document.getElementById('msg-widget-close').addEventListener('click', closeWindow);
        document.getElementById('msg-widget-send').addEventListener('click', () => sendMessage());
        document.getElementById('msg-widget-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        await loadMessages(partnerId);
        setupRealtime();
    }

    // ==========================================
    // CHARGEMENT DES MESSAGES
    // ==========================================
    async function loadMessages(partnerId) {
        const container = document.getElementById('msg-widget-messages');
        if (!container) return;

        try {
            const { data: msgs, error } = await supabase.rpc('get_messages_with', { partner: partnerId });
            if (error) throw error;

            container.innerHTML = '';
            if (!msgs || msgs.length === 0) {
                container.innerHTML = `
                    <div class="messaging-widget-empty">
                        <i class="fas fa-comment-slash"></i>
                        <p>Aucun message encore.<br>Commencez la conversation !</p>
                    </div>
                `;
            } else {
                msgs.forEach(m => appendMessage(m, container));
            }
            container.scrollTop = container.scrollHeight;

            // Marquer comme lu
            await supabase.rpc('mark_messages_read', { partner: partnerId });
            updateUnreadBadge();
        } catch (err) {
            console.error('Erreur chargement messages:', err);
            container.innerHTML = `<div class="messaging-widget-empty"><p>Erreur de chargement</p></div>`;
        }
    }

    // ==========================================
    // CHARGEMENT CONVERSATIONS ADMIN
    // ==========================================
    async function loadAdminConversations() {
        const container = document.getElementById('msg-widget-conversations');
        if (!container) return;

        try {
            const { data: partners, error } = await supabase.rpc('get_conversation_partners');
            if (error) throw error;

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
                        <div class="messaging-widget-conv-preview">Cliquez pour ouvrir la conversation</div>
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
            console.error('Erreur chargement conversations:', err);
            container.innerHTML = `<div class="messaging-widget-empty"><p>Erreur de chargement</p></div>`;
        }
    }

    // ==========================================
    // AJOUTER UN MESSAGE AU DOM
    // ==========================================
    function appendMessage(msg, container) {
        const isMe = msg.sender_id === state.myId;
        const div = document.createElement('div');
        div.className = `messaging-widget-msg ${isMe ? 'sent' : 'received'}`;
        div.innerHTML = `
            ${escapeHtml(msg.content)}
            <span class="messaging-widget-msg-time">${formatTime(msg.created_at)}</span>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    // ==========================================
    // ENVOI DE MESSAGE
    // ==========================================
    async function sendMessage() {
        const input = document.getElementById('msg-widget-input');
        const content = input?.value.trim();
        if (!content) return;

        const receiverId = state.isAdmin ? state.activePartner : state.teacherId;
        if (!receiverId) return;

        if (input) input.value = '';

        try {
            const { error } = await supabase.from('messages').insert({
                sender_id: state.myId,
                receiver_id: receiverId,
                content: content
            });
            if (error) throw error;
        } catch (err) {
            console.error('Erreur envoi:', err);
            if (input) input.value = content;
            alert('Erreur d\'envoi : ' + err.message);
        }
    }

    // ==========================================
    // TEMPS RÉEL (Realtime)
    // ==========================================
    function setupRealtime() {
        if (state.channel) {
            state.channel.unsubscribe();
        }

        const partnerId = state.isAdmin ? state.activePartner : state.teacherId;
        if (!partnerId || !state.myId) return;

        // Utiliser le filtre 'in' pour n'écouter que les messages
        // où receiver_id est l'un des deux participants (moi ou mon partenaire)
        // Puis on filtre côté client pour la conversation active
        state.channel = supabase
            .channel('widget-messages-' + state.myId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=in.(${state.myId},${partnerId})`
            }, (payload) => {
                const msg = payload.new;
                // Vérifier que le message concerne bien cette conversation
                const relevant =
                    (msg.sender_id === state.myId && msg.receiver_id === partnerId) ||
                    (msg.sender_id === partnerId && msg.receiver_id === state.myId);

                if (!relevant) return;

                const container = document.getElementById('msg-widget-messages');
                if (container) {
                    // Si c'était l'état vide, le vider
                    if (container.querySelector('.messaging-widget-empty')) {
                        container.innerHTML = '';
                    }
                    appendMessage(msg, container);
                }

                // Si on reçoit un message, marquer comme lu si la fenêtre est ouverte
                if (msg.receiver_id === state.myId && state.isOpen) {
                    supabase.rpc('mark_messages_read', { partner: msg.sender_id });
                }

                // Mettre à jour les badges
                if (!state.isOpen || (state.isAdmin && msg.sender_id !== state.activePartner)) {
                    updateUnreadBadge();
                    if (state.isAdmin && !state.isOpen) {
                        // Refresh la liste des conversations si on est sur la liste
                        const convContainer = document.getElementById('msg-widget-conversations');
                        if (convContainer) loadAdminConversations();
                    }
                }
            })
            .subscribe();
    }

    // ==========================================
    // BADGE NON-LUS
    // ==========================================
    async function updateUnreadBadge() {
        try {
            const { data: partners, error } = await supabase.rpc('get_conversation_partners');
            if (error) throw error;

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
            console.error('Erreur badge:', err);
        }
    }

    // ==========================================
    // DÉTECTION ADMIN vs ÉTUDIANT
    // ==========================================
    async function detectRole() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            state.myId = user.id;

            // Vérifier si admin via edge function (utilise ADMIN_EMAILS)
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) return false;

            const res = await fetch(`${window.YOTEACHER_CONFIG.SUPABASE_URL}/functions/v1/teacher-info`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const teacher = await res.json();
                // Si mon ID correspond à l'ID du professeur → je suis admin
                if (teacher.id === user.id) {
                    state.isAdmin = true;
                    state.teacherId = user.id;
                    return true;
                }
                // Sinon je suis étudiant, le prof est teacher.id
                state.teacherId = teacher.id;
                state.teacherName = teacher.full_name;
                state.isAdmin = false;
                return true;
            }
            return false;
        } catch (err) {
            console.error('Erreur détection rôle:', err);
            return false;
        }
    }

    // ==========================================
    // INITIALISATION
    // ==========================================
    async function init() {
        // Attendre que Supabase soit prêt
        if (!window.supabase) {
            console.log('⏳ Attente Supabase...');
            setTimeout(init, 500);
            return;
        }

        const ready = await detectRole();
        if (!ready) {
            console.log('❌ Widget messagerie : utilisateur non authentifié');
            return;
        }

        createWidget();
        updateUnreadBadge();

        // Rafraîchir le badge toutes les 30 secondes
        setInterval(updateUnreadBadge, 30000);

        console.log('✅ Widget messagerie initialisé —', state.isAdmin ? 'Admin' : 'Étudiant');
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
