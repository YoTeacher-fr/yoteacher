// translation.js - Version simplifiée et corrigée
class TranslationManager {
    constructor() {
        this.currentLanguage = 'fr';
        this.supportedLanguages = ['fr', 'en'];
        this.translations = {
            fr: {
                // Navigation et Header
                'nav.about': 'À propos',
                'nav.courses': 'Cours',
                'nav.testimonials': 'Témoignages',
                'nav.contact': 'Contact',
                'header.login': 'Connexion',
                'header.language': 'EN',
                
                // Hero section
                'hero.title': 'Apprenez le français simplement',
                'hero.subtitle': 'Professeur natif • Cours chaleureux et personnalisés pour adultes',
                'hero.stat1': 'Ans d\'expérience',
                'hero.stat2': 'Étudiants',
                'hero.stat3': 'Leçons données',
                'hero.trial': 'Réserver un cours d\'essai',
                'hero.signup': 'Créer un compte gratuit',
                
                // About section
                'about.label': 'À propos de Yoann',
                'about.title': 'Votre guide vers la maîtrise du',
                'about.french': 'français',
                'about.text1': 'Bonjour ! Je suis Yoann, professeur de français passionné depuis 5 ans. Originaire de Marseille, dans le sud de la France, j\'ai décidé de quitter ma carrière de comptable pour suivre ma vraie passion : enseigner le français et voyager à travers le monde.',
                'about.text2': 'Avec plus de 75 pays visités en 6 ans, j\'apporte une richesse culturelle unique à mes cours. Cette expérience me permet d\'aborder des sujets variés et de comprendre les défis spécifiques de chaque culture dans l\'apprentissage du français.',
                'about.highlight1': 'Originaire de Marseille',
                'about.highlight2': '75 pays visités',
                'about.highlight3': 'Ancien comptable reconverti',
                'about.highlight4': 'Certifié en anglais',
                'about.personality': 'Ce que mes étudiants disent de moi :',
                'about.tag1': 'Professionnel',
                'about.tag2': 'Chaleureux et sociable',
                'about.tag3': 'Ouvert d\'esprit',
                'about.tag4': 'Aventureux',
                'about.tag5': 'Bienveillant',
                'about.tag6': 'Dynamique',
                
                // Courses section
                'courses.label': 'Mes cours',
                'courses.title': 'Des formules adaptées à',
                'courses.your_needs': 'vos besoins',
                'courses.subtitle': 'Choisissez la formule qui vous convient et commencez votre voyage linguistique',
                'courses.conversation': 'Conversation',
                'courses.conversation_focus': 'Discussion uniquement',
                'courses.curriculum': 'Curriculum Complet',
                'courses.curriculum_focus': 'Grammaire, exercices, structure',
                'courses.exam': 'Préparation d\'examen',
                'courses.exam_focus': 'DELF, DALF, TCF',
                'courses.feature1': 'Fluidité à l\'oral',
                'courses.feature2': 'Vocabulaire quotidien',
                'courses.feature3': 'Correction en temps réel',
                'courses.feature4': 'Sujets variés d\'actualité',
                'courses.feature5': 'Grammaire approfondie',
                'courses.feature6': 'Exercices personnalisés',
                'courses.feature7': 'Structure complète',
                'courses.feature8': 'Programme sur mesure',
                'courses.feature9': 'Simulations d\'examen',
                'courses.feature10': 'Correction détaillée',
                'courses.feature11': 'Stratégies de réussite',
                'courses.feature12': 'Feedbacks personnalisés',
                'courses.button_reserve': 'Réserver',
                'courses.button_choose': 'Choisir ce cours',
                'courses.duration_60': '60 minutes',
                'courses.detail_30min': '30min',
                'courses.detail_45min': '45min',
                'courses.detail_forfait': 'Forfait 10 cours',
                'courses.price_per_hour': '/h',
                'courses.discount': '(-5%)',
                
                // Testimonials
                'testimonials.label': 'Témoignages',
                'testimonials.title': 'Ce que disent mes',
                'testimonials.students': 'étudiants',
                'testimonials.subtitle': 'Plus de 500 étudiants satisfaits à travers le monde',
                
                // CTA section
                'cta.title': 'Prêt à commencer votre voyage vers la',
                'cta.mastery': 'maîtrise du français',
                'cta.subtitle': 'Rejoignez plus de 500 étudiants satisfaits. Réservez votre cours d\'essai aujourd\'hui et découvrez une nouvelle façon d\'apprendre le français.',
                'cta.trial': 'Essayer maintenant',
                'cta.account': 'Créer un compte gratuit',
                'cta.note1': 'Conversion automatique selon votre localisation',
                'cta.note2': 'Paiement sécurisé',
                'cta.note3': 'Annulation gratuite 24h avant',
                
                // Footer
                'footer.tagline': 'Cours de français en ligne pour adultes. Apprenez avec confiance et plaisir avec un professeur natif passionné.',
                'footer.teacher': 'Professeur natif de Marseille',
                'footer.countries': '75 pays visités',
                'footer.students': '500+ étudiants',
                'footer.quick_links': 'Liens rapides',
                'footer.home': 'Accueil',
                'footer.legal': 'Mentions légales',
                'footer.terms': 'Conditions Générales de Vente',
                'footer.privacy': 'Politique de confidentialité',
                'footer.cancellation': 'Politique d\'annulation',
                'footer.copyright': 'Fait avec ❤️ à Marseille',
                'footer.email': 'contact@yoteacher.com',
            },
            en: {
                // Navigation et Header
                'nav.about': 'About',
                'nav.courses': 'Courses',
                'nav.testimonials': 'Testimonials',
                'nav.contact': 'Contact',
                'header.login': 'Login',
                'header.language': 'FR',
                
                // Hero section
                'hero.title': 'Learn French Simply',
                'hero.subtitle': 'Native Teacher • Warm and Personalized Lessons for Adults',
                'hero.stat1': 'Years of experience',
                'hero.stat2': 'Students',
                'hero.stat3': 'Lessons given',
                'hero.trial': 'Book a trial lesson',
                'hero.signup': 'Create a free account',
                
                // About section
                'about.label': 'About Yoann',
                'about.title': 'Your Guide to Mastering',
                'about.french': 'French',
                'about.text1': 'Hello! I\'m Yoann, a passionate French teacher for 5 years. Originally from Marseille, in the south of France, I decided to leave my accounting career to follow my true passion: teaching French and traveling around the world.',
                'about.text2': 'With over 75 countries visited in 6 years, I bring unique cultural richness to my lessons. This experience allows me to address varied topics and understand the specific challenges of each culture in learning French.',
                'about.highlight1': 'Originally from Marseille',
                'about.highlight2': '75 countries visited',
                'about.highlight3': 'Former accountant retrained',
                'about.highlight4': 'Certified in English',
                'about.personality': 'What my students say about me:',
                'about.tag1': 'Professional',
                'about.tag2': 'Warm and sociable',
                'about.tag3': 'Open-minded',
                'about.tag4': 'Adventurous',
                'about.tag5': 'Benevolent',
                'about.tag6': 'Dynamic',
                
                // Courses section
                'courses.label': 'My Courses',
                'courses.title': 'Formulas Adapted to',
                'courses.your_needs': 'Your Needs',
                'courses.subtitle': 'Choose the formula that suits you and start your language journey',
                'courses.conversation': 'Conversation',
                'courses.conversation_focus': 'Discussion only',
                'courses.curriculum': 'Complete Curriculum',
                'courses.curriculum_focus': 'Grammar, exercises, structure',
                'courses.exam': 'Exam Preparation',
                'courses.exam_focus': 'DELF, DALF, TCF',
                'courses.feature1': 'Oral fluency',
                'courses.feature2': 'Daily vocabulary',
                'courses.feature3': 'Real-time correction',
                'courses.feature4': 'Varied current topics',
                'courses.feature5': 'In-depth grammar',
                'courses.feature6': 'Personalized exercises',
                'courses.feature7': 'Complete structure',
                'courses.feature8': 'Customized program',
                'courses.feature9': 'Exam simulations',
                'courses.feature10': 'Detailed correction',
                'courses.feature11': 'Success strategies',
                'courses.feature12': 'Personalized feedback',
                'courses.button_reserve': 'Book',
                'courses.button_choose': 'Choose this course',
                'courses.duration_60': '60 minutes',
                'courses.detail_30min': '30min',
                'courses.detail_45min': '45min',
                'courses.detail_forfait': '10-course package',
                'courses.price_per_hour': '/h',
                'courses.discount': '(-5%)',
                
                // Testimonials
                'testimonials.label': 'Testimonials',
                'testimonials.title': 'What my',
                'testimonials.students': 'students say',
                'testimonials.subtitle': 'Over 500 satisfied students worldwide',
                
                // CTA section
                'cta.title': 'Ready to start your journey to',
                'cta.mastery': 'mastering French',
                'cta.subtitle': 'Join over 500 satisfied students. Book your trial lesson today and discover a new way to learn French.',
                'cta.trial': 'Try now',
                'cta.account': 'Create a free account',
                'cta.note1': 'Automatic conversion based on your location',
                'cta.note2': 'Secure payment',
                'cta.note3': 'Free cancellation 24h before',
                
                // Footer
                'footer.tagline': 'Online French lessons for adults. Learn with confidence and pleasure with a passionate native teacher.',
                'footer.teacher': 'Native teacher from Marseille',
                'footer.countries': '75 countries visited',
                'footer.students': '500+ students',
                'footer.quick_links': 'Quick Links',
                'footer.home': 'Home',
                'footer.legal': 'Legal Notice',
                'footer.terms': 'Terms and Conditions',
                'footer.privacy': 'Privacy Policy',
                'footer.cancellation': 'Cancellation Policy',
                'footer.copyright': 'Made with ❤️ in Marseille',
                'footer.email': 'contact@yoteacher.com',
            }
        };
        
        this.initialize();
    }

    initialize() {
        // Récupérer la langue depuis localStorage
        const savedLanguage = localStorage.getItem('language');
        
        if (savedLanguage && this.supportedLanguages.includes(savedLanguage)) {
            this.currentLanguage = savedLanguage;
        } else {
            // Détecter la langue du navigateur
            const browserLanguage = navigator.language.split('-')[0];
            if (this.supportedLanguages.includes(browserLanguage)) {
                this.currentLanguage = browserLanguage;
            }
        }
        
        console.log(`🌍 Langue initiale: ${this.currentLanguage}`);
        
        // Initialiser dès que le DOM est prêt
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.init();
            });
        } else {
            this.init();
        }
    }

    init() {
        console.log('🌍 Initialisation du gestionnaire de traduction...');
        
        // Mettre à jour la page
        this.updatePage();
        
        // Ajouter les écouteurs d'événements
        this.addEventListeners();
    }

    addEventListeners() {
        console.log('🌍 Ajout des écouteurs d\'événements...');
        
        // Écouteur pour le sélecteur de langue desktop
        const desktopSwitcher = document.getElementById('languageSwitcherDesktop');
        if (desktopSwitcher) {
            desktopSwitcher.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🌍 Clic sur le sélecteur de langue desktop');
                this.toggleLanguage();
            });
        }
        
        // Écouteur pour le sélecteur de langue mobile
        const mobileSwitcher = document.getElementById('languageSwitcherMobile');
        if (mobileSwitcher) {
            mobileSwitcher.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🌍 Clic sur le sélecteur de langue mobile');
                this.toggleLanguage();
                
                // Fermer le menu mobile après changement
                const mobileMenu = document.getElementById('mobileMenu');
                if (mobileMenu && mobileMenu.classList.contains('active')) {
                    mobileMenu.classList.remove('active');
                }
            });
        }
        
        console.log('✅ Écouteurs d\'événements ajoutés');
    }

    toggleLanguage() {
        // Basculer la langue
        this.currentLanguage = this.currentLanguage === 'fr' ? 'en' : 'fr';
        
        // Sauvegarder dans localStorage
        localStorage.setItem('language', this.currentLanguage);
        
        console.log(`🌍 Changement de langue vers: ${this.currentLanguage}`);
        
        // Mettre à jour la page
        this.updatePage();
        
        // Déclencher un événement pour informer les autres scripts
        window.dispatchEvent(new CustomEvent('language:changed', { 
            detail: { language: this.currentLanguage } 
        }));
    }

    updatePage() {
        console.log(`🌍 Mise à jour de la page en ${this.currentLanguage}`);
        
        // Mettre à jour l'attribut lang de la page
        document.documentElement.lang = this.currentLanguage;
        
        // Appliquer les traductions
        this.applyTranslations();
        
        // Mettre à jour les sélecteurs de langue (affichage inversé)
        this.updateLanguageSwitchers();
        
        console.log('✅ Page traduite avec succès');
    }

    applyTranslations() {
        // Traduire les éléments avec data-i18n
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getTranslation(key);
            if (translation && translation !== key) {
                element.textContent = translation;
            }
        });

        // Traduire les placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.getTranslation(key);
            if (translation && translation !== key) {
                element.placeholder = translation;
            }
        });

        // Traduire les attributs title
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.getTranslation(key);
            if (translation && translation !== key) {
                element.title = translation;
            }
        });
    }

    updateLanguageSwitchers() {
        // Mettre à jour les boutons de langue (affichage inversé)
        const languageSwitchers = document.querySelectorAll('.language-switcher span:last-child, .mobile-language span:last-child');
        
        languageSwitchers.forEach(switcher => {
            // Afficher "EN" quand le site est en français, et "FR" quand le site est en anglais
            switcher.textContent = this.currentLanguage === 'fr' ? 'EN' : 'FR';
            
            // Ajouter un tooltip
            const parent = switcher.closest('.language-switcher, .mobile-language');
            if (parent) {
                parent.title = this.currentLanguage === 'fr' 
                    ? 'Switch to English' 
                    : 'Passer en Français';
            }
        });
    }

    getTranslation(key) {
        // Récupérer la traduction pour la langue courante
        if (this.translations[this.currentLanguage] && this.translations[this.currentLanguage][key]) {
            return this.translations[this.currentLanguage][key];
        }
        
        // Fallback sur le français
        if (this.translations['fr'] && this.translations['fr'][key]) {
            return this.translations['fr'][key];
        }
        
        // Retourner la clé si aucune traduction n'est trouvée
        return key;
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    setLanguage(language) {
        if (this.supportedLanguages.includes(language)) {
            this.currentLanguage = language;
            localStorage.setItem('language', language);
            this.updatePage();
            return true;
        }
        return false;
    }
}

// Initialiser et exposer le gestionnaire de traduction
window.translationManager = new TranslationManager();