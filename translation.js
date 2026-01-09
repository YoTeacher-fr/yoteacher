// translations.js
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
                'header.logout': 'Déconnexion',
                'header.dashboard': 'Mon tableau de bord',
                'header.profile': 'Mon profil',
                'header.bookings': 'Mes réservations',
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
                'courses.button': 'Choisir ce cours',
                'courses.detail_forfait': 'Forfait 10 cours',
                
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
                
                // Booking page
                'booking.title': 'Réserver un cours',
                'booking.subtitle': 'Choisissez la date, l\'heure et le type de cours qui vous convient',
                'booking.choose_slot': 'Choisir un créneau',
                'booking.available_slots': 'Créneaux disponibles',
                'booking.details': 'Détails de la réservation',
                'booking.course_type': 'Type de cours',
                'booking.select_course': 'Sélectionnez un type de cours',
                'booking.trial': 'Cours d\'essai (15 min)',
                'booking.conversation': 'Conversation',
                'booking.curriculum': 'Curriculum complet',
                'booking.examen': 'Préparation d\'examen',
                'booking.duration': 'Durée du cours',
                'booking.courses_count': 'Nombre de cours',
                'booking.communication': 'Moyen de communication',
                'booking.full_name': 'Nom complet',
                'booking.email': 'Email',
                'booking.notes': 'Notes pour le professeur (optionnel)',
                'booking.notes_placeholder': 'Votre niveau, objectifs, sujets de discussion préférés...',
                'booking.summary': 'Récapitulatif',
                'booking.summary_type': 'Type de cours:',
                'booking.summary_courses': 'Nombre de cours:',
                'booking.summary_discount': 'Réduction:',
                'booking.summary_date': 'Date:',
                'booking.summary_time': 'Heure:',
                'booking.summary_duration': 'Durée:',
                'booking.summary_platform': 'Plateforme:',
                'booking.summary_total': 'Total:',
                'booking.book_pay': 'Réserver et payer',
                'booking.secure_note': 'Vous serez redirigé vers la page de paiement après confirmation',
                'booking.loading_slots': 'Chargement des créneaux...',
                'booking.no_slots': 'Aucun créneau disponible pour cette date.',
                'booking.all_slots_taken': 'Tous les créneaux sont complets pour aujourd\'hui.',
                'booking.error_slots': 'Erreur lors du chargement des créneaux',
                'booking.retry': 'Réessayer',
                'booking.login_required': 'Pour réserver un cours',
                'booking.login_link': 'connectez-vous',
                'booking.signup_link': 'créez un compte',
                'booking.duration_30': '30 min',
                'booking.duration_45': '45 min',
                'booking.duration_60': '60 min',
                'booking.courses_1': '1 cours',
                'booking.courses_5': '5 cours',
                'booking.courses_10': '10 cours',
                'booking.platform_zoom': 'Zoom',
                'booking.platform_teams': 'Teams',
                'booking.platform_meet': 'Meet',
                'booking.select_date': 'Sélectionnez une date',
                'booking.select_time': 'Sélectionnez une heure',
                'booking.payment_redirect': 'Redirection vers le paiement...',
                //Payment page
'payment.title': 'Finaliser votre paiement',
'payment.subtitle': 'Choisissez votre moyen de paiement et confirmez votre réservation',
'payment.choose_method': 'Choisir un moyen de paiement',
'payment.method.revolut': 'Revolut',
'payment.method.wise': 'Wise',
'payment.method.interac': 'Interac',
'payment.method.paypal': 'PayPal',
'payment.method.card': 'Visa/Mastercard/Amex (Stripe)',
'payment.details.link': 'Lien {method}',
'payment.details.beneficiary': 'Nom du bénéficiaire',
'payment.details.reference': 'Référence',
'payment.details.amount': 'Montant',
'payment.details.email': 'Email {method}',
'payment.details.security_question': 'Question de sécurité',
'payment.details.security_answer': 'Réponse',
'payment.note.revolut': 'Une fois le paiement effectué sur Revolut, cliquez sur "J\'ai payé avec Revolut" pour confirmer votre réservation.',
'payment.note.wise': 'Une fois le paiement effectué sur Wise, cliquez sur "J\'ai payé avec Wise" pour confirmer votre réservation.',
'payment.note.interac': 'Une fois le virement effectué, cliquez sur "J\'ai payé avec Interac" pour confirmer votre réservation.',
'payment.note.paypal': 'Une fois le paiement effectué sur PayPal, cliquez sur "J\'ai payé avec PayPal" pour confirmer votre réservation.',
'payment.note.card': 'Votre paiement est chiffré et sécurisé par Stripe. Aucune information bancaire n\'est stockée sur nos serveurs.',
'payment.button.revolut': 'J\'ai payé avec Revolut',
'payment.button.wise': 'J\'ai payé avec Wise',
'payment.button.interac': 'J\'ai payé avec Interac',
'payment.button.paypal': 'J\'ai payé avec PayPal',
'payment.button.card': 'Payer par carte',
'payment.summary': 'Récapitulatif',
'payment.summary.title': 'Détails de votre réservation',
'payment.summary.type': 'Type de cours:',
'payment.summary.date': 'Date:',
'payment.summary.time': 'Heure:',
'payment.summary.duration': 'Durée:',
'payment.summary.platform': 'Plateforme:',
'payment.summary.total': 'Total à payer:',
'payment.security.title': 'Paiement 100% sécurisé',
'payment.security.encrypted': 'Vos données bancaires sont chiffrées',
'payment.security.no_storage': 'Aucune information stockée sur nos serveurs',
'payment.security.guaranteed': 'Réservation garantie après paiement',
'payment.booking_note': 'Votre créneau est réservé pendant 15 minutes. Une fois le paiement confirmé, vous recevrez un email avec le lien de la visioconférence.',
'payment.currency_note': 'Prix affichés en {currency} - Conversion automatique',
'payment.interac_note': 'Note importante : Les paiements Interac doivent être effectués en dollars canadiens (CAD). La devise a été automatiquement ajustée pour vous.',
'payment.error.interac_currency': 'Les paiements Interac doivent être effectués en dollars canadiens (CAD). Veuillez sélectionner CAD comme devise.',
'payment.interac.title': 'Paiement Interac',
'payment.interac.instructions': 'Veuillez effectuer un virement Interac aux coordonnées suivantes :',
'payment.important': 'Important :',
'payment.secure': 'Sécurisé :',
                // Login page
                'login.title': 'Connexion',
                'login.subtitle': 'Connectez-vous à votre espace étudiant',
                'login.email': 'Adresse email',
                'login.email_placeholder': 'votre@email.com',
                'login.password': 'Mot de passe',
                'login.password_placeholder': 'Votre mot de passe',
                'login.forgot': 'Mot de passe oublié ?',
                'login.submit': 'Se connecter',
                'login.loading': 'Connexion en cours...',
                'login.success': 'Connexion réussie ! Redirection...',
                'login.no_account': 'Pas encore de compte ?',
                'login.signup': 'S\'inscrire gratuitement',
                
                // Signup page
                'signup.title': 'Inscription',
                'signup.subtitle': 'Créez votre compte gratuitement',
                'signup.full_name': 'Nom complet',
                'signup.full_name_placeholder': 'Votre nom et prénom',
                'signup.email': 'Adresse email',
                'signup.email_placeholder': 'votre@email.com',
                'signup.password': 'Mot de passe',
                'signup.password_placeholder': 'Au moins 6 caractères',
                'signup.password_hint': 'Minimum 6 caractères',
                'signup.confirm_password': 'Confirmer le mot de passe',
                'signup.confirm_placeholder': 'Retapez votre mot de passe',
                'signup.terms': 'En vous inscrivant, vous acceptez nos',
                'signup.terms_link': 'Conditions d\'utilisation',
                'signup.privacy_link': 'Politique de confidentialité',
                'signup.submit': 'Créer mon compte',
                'signup.loading': 'Création du compte...',
                'signup.success': 'Compte créé avec succès !',
                'signup.has_account': 'Déjà un compte ?',
                'signup.login': 'Se connecter',
                
                // Dashboard
                'dashboard.welcome': 'Bienvenue',
                'dashboard.welcome_subtitle': 'Bienvenue sur votre dashboard YoTeacher',
                'dashboard.upcoming': 'Cours à venir',
                'dashboard.credits': 'Mes crédits',
                'dashboard.profile': 'Mon Profil',
                'dashboard.book_course': 'Réserver un cours',
                'dashboard.edit_profile': 'Modifier mon profil',
                'dashboard.no_lessons': 'Aucun cours programmé',
                'dashboard.no_credits': 'Aucun crédit disponible',
                'dashboard.time': 'Heure',
                'dashboard.duration': 'Durée',
                'dashboard.type': 'Type',
                'dashboard.reference': 'Référence',
                'dashboard.cancel': 'Annuler',
                'dashboard.reschedule': 'Reporter',
                'dashboard.trial': 'Cours d\'essai',
                'dashboard.trial_subtitle': 'Découvrez ma méthode',
                'dashboard.conversation': 'Conversation',
                'dashboard.conversation_subtitle': 'Pratiquez l\'oral',
                'dashboard.curriculum': 'Curriculum',
                'dashboard.curriculum_subtitle': 'Apprentissage complet',
                'dashboard.loading': 'Chargement de vos données...',
                
                // Profile page
                'profile.title': 'Informations personnelles',
                'profile.subtitle': 'Mettez à jour vos informations de contact',
                'profile.first_name': 'Prénom',
                'profile.last_name': 'Nom',
                'profile.email': 'Adresse email',
                'profile.description': 'Description (optionnel)',
                'profile.description_placeholder': 'Parlez-nous un peu de vous...',
                'profile.save': 'Enregistrer les modifications',
                'profile.language_level': 'Niveau de français',
                'profile.language_subtitle': 'Définissez votre niveau actuel en français',
                'profile.current_level': 'Niveau actuel (CEFR)',
                'profile.select_level': 'Sélectionnez votre niveau',
                'profile.learning_goals': 'Objectifs d\'apprentissage',
                'profile.goals_placeholder': 'Ex: Préparer le DELF B2, Améliorer mon français professionnel...',
                'profile.save_preferences': 'Enregistrer les préférences',
                'profile.password': 'Changer le mot de passe',
                'profile.password_subtitle': 'Mettez à jour votre mot de passe de connexion',
                'profile.current_password': 'Mot de passe actuel',
                'profile.new_password': 'Nouveau mot de passe',
                'profile.confirm_password': 'Confirmer le nouveau mot de passe',
                'profile.change_password': 'Changer le mot de passe',
                'profile.change_photo': 'Changer la photo',
                'profile.photo_help': 'JPG, PNG - max 5MB',
                'profile.personal_info': 'Informations',
                'profile.language_tab': 'Niveau français',
                'profile.password_tab': 'Mot de passe',
                
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
                
                // Common
                'common.loading': 'Chargement...',
                'common.error': 'Erreur',
                'common.success': 'Succès',
                'common.required': 'obligatoire',
                'common.optional': 'optionnel',
                'common.back': 'Retour',
                'common.continue': 'Continuer',
                'common.save': 'Enregistrer',
                'common.cancel': 'Annuler',
                'common.confirm': 'Confirmer',
                'common.search': 'Rechercher',
                'common.filter': 'Filtrer',
                'common.sort': 'Trier',
                'common.view_all': 'Voir tout',
                'common.see_more': 'Voir plus',
                'common.see_less': 'Voir moins',
                'common.close': 'Fermer',
                'common.menu': 'Menu',
                'common.home': 'Accueil',
                'common.settings': 'Paramètres',
                'common.help': 'Aide',
                'common.support': 'Support',
                'common.privacy': 'Confidentialité',
                'common.terms': 'Conditions',
                'common.currency': 'Devise',
                'common.language': 'Langue',
                'common.french': 'Français',
                'common.english': 'Anglais',
                'common.min': 'min',
                'common.hour': 'h',
                'common.day': 'jour',
                'common.week': 'semaine',
                'common.month': 'mois',
                'common.year': 'an',
                'common.today': 'Aujourd\'hui',
                'common.tomorrow': 'Demain',
                'common.yesterday': 'Hier',
                'common.yes': 'Oui',
                'common.no': 'Non',
                'common.ok': 'OK',
                'common.apply': 'Appliquer',
                'common.reset': 'Réinitialiser',
                'common.delete': 'Supprimer',
                'common.edit': 'Modifier',
                'common.add': 'Ajouter',
                'common.remove': 'Supprimer',
                'common.create': 'Créer',
                'common.update': 'Mettre à jour',
                'common.send': 'Envoyer',
                'common.currency_symbol': '€'
            },
            en: {
                // Navigation et Header
                'nav.about': 'About',
                'nav.courses': 'Courses',
                'nav.testimonials': 'Testimonials',
                'nav.contact': 'Contact',
                'header.login': 'Login',
                'header.logout': 'Logout',
                'header.dashboard': 'My Dashboard',
                'header.profile': 'My Profile',
                'header.bookings': 'My Bookings',
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
                'courses.button': 'Choose this course',
                'courses.detail_forfait': '10-course package',
                
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
                
                // Booking page
                'booking.title': 'Book a Lesson',
                'booking.subtitle': 'Choose the date, time and type of lesson that suits you',
                'booking.choose_slot': 'Choose a Time Slot',
                'booking.available_slots': 'Available Slots',
                'booking.details': 'Booking Details',
                'booking.course_type': 'Lesson Type',
                'booking.select_course': 'Select a lesson type',
                'booking.trial': 'Trial lesson (15 min)',
                'booking.conversation': 'Conversation',
                'booking.curriculum': 'Complete curriculum',
                'booking.examen': 'Exam preparation',
                'booking.duration': 'Lesson Duration',
                'booking.courses_count': 'Number of Lessons',
                'booking.communication': 'Communication Method',
                'booking.full_name': 'Full Name',
                'booking.email': 'Email',
                'booking.notes': 'Notes for the teacher (optional)',
                'booking.notes_placeholder': 'Your level, goals, preferred discussion topics...',
                'booking.summary': 'Summary',
                'booking.summary_type': 'Lesson type:',
                'booking.summary_courses': 'Number of lessons:',
                'booking.summary_discount': 'Discount:',
                'booking.summary_date': 'Date:',
                'booking.summary_time': 'Time:',
                'booking.summary_duration': 'Duration:',
                'booking.summary_platform': 'Platform:',
                'booking.summary_total': 'Total:',
                'booking.book_pay': 'Book and Pay',
                'booking.secure_note': 'You will be redirected to the payment page after confirmation',
                'booking.loading_slots': 'Loading available slots...',
                'booking.no_slots': 'No slots available for this date.',
                'booking.all_slots_taken': 'All slots are full for today.',
                'booking.error_slots': 'Error loading slots',
                'booking.retry': 'Retry',
                'booking.login_required': 'To book a',
                'booking.login_link': 'log in',
                'booking.signup_link': 'create an account',
                'booking.duration_30': '30 min',
                'booking.duration_45': '45 min',
                'booking.duration_60': '60 min',
                'booking.courses_1': '1 lesson',
                'booking.courses_5': '5 lessons',
                'booking.courses_10': '10 lessons',
                'booking.platform_zoom': 'Zoom',
                'booking.platform_teams': 'Teams',
                'booking.platform_meet': 'Meet',
                'booking.select_date': 'Select a date',
                'booking.select_time': 'Select a time',
                'booking.payment_redirect': 'Redirecting to payment...',
                // Payment page
'payment.title': 'Finalize Your Payment',
'payment.subtitle': 'Choose your payment method and confirm your booking',
'payment.choose_method': 'Choose a Payment Method',
'payment.method.revolut': 'Revolut',
'payment.method.wise': 'Wise',
'payment.method.interac': 'Interac',
'payment.method.paypal': 'PayPal',
'payment.method.card': 'Visa/Mastercard/Amex (Stripe)',
'payment.details.link': '{method} Link',
'payment.details.beneficiary': 'Beneficiary Name',
'payment.details.reference': 'Reference',
'payment.details.amount': 'Amount',
'payment.details.email': '{method} Email',
'payment.details.security_question': 'Security Question',
'payment.details.security_answer': 'Answer',
'payment.note.revolut': 'Once the payment is made on Revolut, click "I paid with Revolut" to confirm your booking.',
'payment.note.wise': 'Once the payment is made on Wise, click "I paid with Wise" to confirm your booking.',
'payment.note.interac': 'Once the transfer is made, click "I paid with Interac" to confirm your booking.',
'payment.note.paypal': 'Once the payment is made on PayPal, click "I paid with PayPal" to confirm your booking.',
'payment.note.card': 'Your payment is encrypted and secured by Stripe. No banking information is stored on our servers.',
'payment.button.revolut': 'I paid with Revolut',
'payment.button.wise': 'I paid with Wise',
'payment.button.interac': 'I paid with Interac',
'payment.button.paypal': 'I paid with PayPal',
'payment.button.card': 'Pay by Card',
'payment.summary': 'Summary',
'payment.summary.title': 'Your Booking Details',
'payment.summary.type': 'Lesson type:',
'payment.summary.date': 'Date:',
'payment.summary.time': 'Time:',
'payment.summary.duration': 'Duration:',
'payment.summary.platform': 'Platform:',
'payment.summary.total': 'Total to pay:',
'payment.security.title': '100% Secure Payment',
'payment.security.encrypted': 'Your banking data is encrypted',
'payment.security.no_storage': 'No information stored on our servers',
'payment.security.guaranteed': 'Booking guaranteed after payment',
'payment.booking_note': 'Your time slot is reserved for 15 minutes. Once the payment is confirmed, you will receive an email with the video conference link.',
'payment.currency_note': 'Prices displayed in {currency} - Automatic conversion',
'payment.interac_note': 'Important note: Interac payments must be made in Canadian dollars (CAD). The currency has been automatically adjusted for you.',
'payment.error.interac_currency': 'Interac payments must be made in Canadian dollars (CAD). Please select CAD as currency.',
'payment.interac.title': 'Interac Payment',
'payment.interac.instructions': 'Please make an Interac transfer to the following details:',
'payment.important': 'Important:',
'payment.secure': 'Secure:',
                // Login page
                'login.title': 'Login',
                'login.subtitle': 'Log in to your student space',
                'login.email': 'Email address',
                'login.email_placeholder': 'your@email.com',
                'login.password': 'Password',
                'login.password_placeholder': 'Your password',
                'login.forgot': 'Forgot password?',
                'login.submit': 'Log in',
                'login.loading': 'Logging in...',
                'login.success': 'Login successful! Redirecting...',
                'login.no_account': 'Don\'t have an account yet?',
                'login.signup': 'Sign up for free',
                
                // Signup page
                'signup.title': 'Sign Up',
                'signup.subtitle': 'Create your free account',
                'signup.full_name': 'Full Name',
                'signup.full_name_placeholder': 'Your first and last name',
                'signup.email': 'Email address',
                'signup.email_placeholder': 'your@email.com',
                'signup.password': 'Password',
                'signup.password_placeholder': 'At least 6 characters',
                'signup.password_hint': 'Minimum 6 characters',
                'signup.confirm_password': 'Confirm Password',
                'signup.confirm_placeholder': 'Re-type your password',
                'signup.terms': 'By signing up, you agree to our',
                'signup.terms_link': 'Terms of Use',
                'signup.privacy_link': 'Privacy Policy',
                'signup.submit': 'Create my account',
                'signup.loading': 'Creating account...',
                'signup.success': 'Account created successfully!',
                'signup.has_account': 'Already have an account?',
                'signup.login': 'Log in',
                
                // Dashboard
                'dashboard.welcome': 'Welcome',
                'dashboard.welcome_subtitle': 'Welcome to your YoTeacher Dashboard',
                'dashboard.upcoming': 'Upcoming Lessons',
                'dashboard.credits': 'My Credits',
                'dashboard.profile': 'My Profile',
                'dashboard.book_course': 'Book a Lesson',
                'dashboard.edit_profile': 'Edit my Profile',
                'dashboard.no_lessons': 'No lessons scheduled',
                'dashboard.no_credits': 'No credits available',
                'dashboard.time': 'Time',
                'dashboard.duration': 'Duration',
                'dashboard.type': 'Type',
                'dashboard.reference': 'Reference',
                'dashboard.cancel': 'Cancel',
                'dashboard.reschedule': 'Reschedule',
                'dashboard.trial': 'Trial Lesson',
                'dashboard.trial_subtitle': 'Discover my method',
                'dashboard.conversation': 'Conversation',
                'dashboard.conversation_subtitle': 'Practice speaking',
                'dashboard.curriculum': 'Curriculum',
                'dashboard.curriculum_subtitle': 'Complete learning',
                'dashboard.loading': 'Loading your data...',
                
                // Profile page
                'profile.title': 'Personal Information',
                'profile.subtitle': 'Update your contact information',
                'profile.first_name': 'First Name',
                'profile.last_name': 'Last Name',
                'profile.email': 'Email Address',
                'profile.description': 'Description (optional)',
                'profile.description_placeholder': 'Tell us a bit about yourself...',
                'profile.save': 'Save Changes',
                'profile.language_level': 'French Level',
                'profile.language_subtitle': 'Define your current French level',
                'profile.current_level': 'Current Level (CEFR)',
                'profile.select_level': 'Select your level',
                'profile.learning_goals': 'Learning Goals',
                'profile.goals_placeholder': 'Ex: Prepare for DELF B2, Improve my professional French...',
                'profile.save_preferences': 'Save Preferences',
                'profile.password': 'Change Password',
                'profile.password_subtitle': 'Update your login password',
                'profile.current_password': 'Current Password',
                'profile.new_password': 'New Password',
                'profile.confirm_password': 'Confirm New Password',
                'profile.change_password': 'Change Password',
                'profile.change_photo': 'Change Photo',
                'profile.photo_help': 'JPG, PNG - max 5MB',
                'profile.personal_info': 'Information',
                'profile.language_tab': 'French Level',
                'profile.password_tab': 'Password',
                
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
                
                // Common
                'common.loading': 'Loading...',
                'common.error': 'Error',
                'common.success': 'Success',
                'common.required': 'required',
                'common.optional': 'optional',
                'common.back': 'Back',
                'common.continue': 'Continue',
                'common.save': 'Save',
                'common.cancel': 'Cancel',
                'common.confirm': 'Confirm',
                'common.search': 'Search',
                'common.filter': 'Filter',
                'common.sort': 'Sort',
                'common.view_all': 'View all',
                'common.see_more': 'See more',
                'common.see_less': 'See less',
                'common.close': 'Close',
                'common.menu': 'Menu',
                'common.home': 'Home',
                'common.settings': 'Settings',
                'common.help': 'Help',
                'common.support': 'Support',
                'common.privacy': 'Privacy',
                'common.terms': 'Terms',
                'common.currency': 'Currency',
                'common.language': 'Language',
                'common.french': 'French',
                'common.english': 'English',
                'common.min': 'min',
                'common.hour': 'h',
                'common.day': 'day',
                'common.week': 'week',
                'common.month': 'month',
                'common.year': 'year',
                'common.today': 'Today',
                'common.tomorrow': 'Tomorrow',
                'common.yesterday': 'Yesterday',
                'common.yes': 'Yes',
                'common.no': 'No',
                'common.ok': 'OK',
                'common.apply': 'Apply',
                'common.reset': 'Reset',
                'common.delete': 'Delete',
                'common.edit': 'Edit',
                'common.add': 'Add',
                'common.remove': 'Remove',
                'common.create': 'Create',
                'common.update': 'Update',
                'common.send': 'Send',
                'common.currency_symbol': '€'
            }
        };
        
        this.initialize();
    }

    initialize() {
        // Récupérer la langue depuis localStorage ou détecter la langue du navigateur
        const savedLanguage = localStorage.getItem('language');
        const browserLanguage = navigator.language.split('-')[0];
        
        if (savedLanguage && this.supportedLanguages.includes(savedLanguage)) {
            this.currentLanguage = savedLanguage;
        } else if (this.supportedLanguages.includes(browserLanguage)) {
            this.currentLanguage = browserLanguage;
        }
        
        // Initialiser le gestionnaire d'événements
        this.initEventListeners();
    }

    initEventListeners() {
        // Écouter les clics sur les sélecteurs de langue
        document.addEventListener('DOMContentLoaded', () => {
            this.updatePage();
            
            // Gérer les sélecteurs de langue dans le header
            const languageSwitchers = document.querySelectorAll('.language-switcher');
            languageSwitchers.forEach(switcher => {
                switcher.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleLanguage();
                });
            });

            // Gérer le sélecteur de langue mobile
            const mobileLanguageSwitchers = document.querySelectorAll('.mobile-language');
            mobileLanguageSwitchers.forEach(switcher => {
                switcher.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleLanguage();
                });
            });
        });
    }

    toggleLanguage() {
        this.currentLanguage = this.currentLanguage === 'fr' ? 'en' : 'fr';
        localStorage.setItem('language', this.currentLanguage);
        this.updatePage();
        
        // Déclencher un événement pour informer les autres composants
        window.dispatchEvent(new CustomEvent('language:changed', { 
            detail: { language: this.currentLanguage } 
        }));
    }

    updatePage() {
        // Mettre à jour le texte des sélecteurs de langue
        const languageDisplays = document.querySelectorAll('.language-switcher span:last-child, .mobile-language span:last-child');
        languageDisplays.forEach(display => {
            display.textContent = this.currentLanguage === 'fr' ? 'FR' : 'EN';
        });

        // Appliquer les traductions aux éléments avec data-i18n
        this.translatePage();
        
        // Mettre à jour les attributs lang
        document.documentElement.lang = this.currentLanguage;
    }

    translatePage() {
        // Traduire les éléments avec data-i18n
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getTranslation(key);
            if (translation) {
                element.textContent = translation;
            }
        });

        // Traduire les placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.getTranslation(key);
            if (translation) {
                element.placeholder = translation;
            }
        });

        // Traduire les titres
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.getTranslation(key);
            if (translation) {
                element.title = translation;
            }
        });

        // Traduire les valeurs d'input
        document.querySelectorAll('[data-i18n-value]').forEach(element => {
            const key = element.getAttribute('data-i18n-value');
            const translation = this.getTranslation(key);
            if (translation) {
                element.value = translation;
            }
        });

        // Traduire les options de sélection
        document.querySelectorAll('option[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getTranslation(key);
            if (translation) {
                element.textContent = translation;
            }
        });
    }

    getTranslation(key) {
        return this.translations[this.currentLanguage]?.[key] || this.translations['fr']?.[key] || key;
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

// Initialiser le gestionnaire de traduction
window.translationManager = new TranslationManager();