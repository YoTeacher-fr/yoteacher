// translation.js - Version étendue avec toutes les pages
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
                'hero.stat4': 'Étudiants accompagnés',
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
                'courses.trial': 'Cours d\'essai',
                
                // Testimonials
                'testimonials.label': 'Témoignages',
                'testimonials.title': 'Ce que disent mes',
                'testimonials.students': 'étudiants',
                'testimonials.subtitle': 'Plus de 500 étudiants satisfaits à travers le monde',
                
                // Testimonials content
                'testimonial.1.name': 'Marina',
                'testimonial.1.country': '🇧🇷 Brésil',
                'testimonial.1.content': 'Yoann est un professeur fantastique ! Ses cours sont dynamiques et il sait vraiment comment me mettre à l\'aise. J\'ai fait des progrès incroyables en seulement quelques mois.',
                'testimonial.1.lessons': '42 cours',
                'testimonial.2.name': 'Kay',
                'testimonial.2.country': '🇺🇸 États-Unis',
                'testimonial.2.content': 'J\'adore apprendre avec Yoann. Il est patient, professionnel et ses cours sont toujours bien préparés. Il s\'adapte parfaitement à mon niveau et mes besoins.',
                'testimonial.2.lessons': '28 cours',
                'testimonial.3.name': 'Julia',
                'testimonial.3.country': '🇩🇪 Allemagne',
                'testimonial.3.content': 'Les cours avec Yoann sont un vrai plaisir ! Il crée une atmosphère détendue où je n\'ai pas peur de faire des erreurs. Ma confiance en français a vraiment augmenté.',
                'testimonial.3.lessons': '15 cours',
                'testimonial.4.name': 'Octavi',
                'testimonial.4.country': '🇪🇸 Espagne',
                'testimonial.4.content': 'Yoann est chaleureux et ouvert d\'esprit. Ses voyages dans 75 pays rendent nos conversations très intéressantes. Je recommande vivement !',
                'testimonial.4.lessons': '56 cours',
                'testimonial.5.name': 'Nahéma',
                'testimonial.5.country': '🇨🇦 Canada',
                'testimonial.5.content': 'Grâce à Yoann, j\'ai réussi mon examen DELF B2 ! Sa méthode de préparation est efficace et il sait exactement comment vous préparer au succès.',
                'testimonial.5.lessons': '24 cours',
                'testimonial.6.name': 'Chen',
                'testimonial.6.country': '🇨🇳 Chine',
                'testimonial.6.content': 'Professeur très professionnel et bienveillant. Il prend le temps d\'expliquer la grammaire clairement et les cours sont toujours vivants et dynamiques.',
                'testimonial.6.lessons': '37 cours',
                'testimonial.7.name': 'Luca',
                'testimonial.7.country': '🇮🇹 Italie',
                'testimonial.7.content': 'Je prépare le DELF B1 avec Yoann et ses conseils sont précieux. Il connaît parfaitement les exigences de l\'examen.',
                'testimonial.7.lessons': '18 cours',
                'testimonial.8.name': 'Sofia',
                'testimonial.8.country': '🇦🇷 Argentine',
                'testimonial.8.content': 'Les cours avec Yoann sont toujours très structurés et intéressants. J\'ai beaucoup progressé en compréhension orale.',
                'testimonial.8.lessons': '32 cours',
                'testimonial.9.name': 'Ahmed',
                'testimonial.9.country': '🇲🇦 Maroc',
                'testimonial.9.content': 'Professeur exceptionnel ! Yoann sait s\'adapter à chaque élève et rend l\'apprentissage du français agréable.',
                'testimonial.9.lessons': '25 cours',
                
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
                'footer.email': 'yoteachfr@gmail.com',
                
                // Booking page
                'booking.page_title': 'Réserver un cours - YoTeacher',
                'booking.title': 'Réserver un cours',
                'booking.subtitle': 'Choisissez la date, l\'heure et le type de cours qui vous convient',
                'booking.choose_slot': 'Choisir un créneau',
                'booking.details': 'Détails de la réservation',
                'booking.available_slots': 'Créneaux disponibles',
                'booking.loading_slots': 'Chargement des créneaux...',
                'booking.no_slots': 'Aucun créneau disponible pour cette date.',
                'booking.no_future_slots': 'Tous les créneaux sont complets pour aujourd\'hui.',
                'booking.error_loading': 'Erreur lors du chargement des créneaux',
                'booking.retry': 'Réessayer',
                'booking.course_type': 'Type de cours',
                'booking.select_course': 'Sélectionnez un type de cours',
                'booking.duration': 'Durée du cours',
                'booking.courses_count': 'Nombre de cours',
                'booking.one_course': '1 cours',
                'booking.five_courses': '5 cours',
                'booking.ten_courses': '10 cours',
                'booking.discount_badge': '-2%',
                'booking.discount_badge_5': '-5%',
                'booking.communication': 'Moyen de communication',
                'booking.zoom': 'Zoom',
                'booking.teams': 'Teams',
                'booking.meet': 'Meet',
                'booking.full_name': 'Nom complet',
                'booking.email': 'Email',
                'booking.notes': 'Notes pour le professeur (optionnel)',
                'booking.notes_placeholder': 'Votre niveau, objectifs, sujets de discussion préférés...',
                'booking.summary': 'Récapitulatif',
                'booking.summary_type': 'Type de cours:',
                'booking.summary_courses': 'Nombre de cours:',
                'booking.courses': 'cours',
                'booking.summary_discount': 'Réduction:',
                'booking.summary_date': 'Date:',
                'booking.summary_time': 'Heure:',
                'booking.summary_duration': 'Durée:',
                'booking.summary_platform': 'Plateforme:',
                'booking.summary_total': 'Total:',
                'booking.book_and_pay': 'Réserver et payer',
                'booking.payment_redirect': 'Vous serez redirigé vers la page de paiement après confirmation',
                'booking.login_required': 'Pour réserver un cours',
                'booking.connect': 'connectez-vous',
                'booking.or': 'ou',
                'booking.create_account': 'créez un compte',
                
                // Login page
                'login.title': 'Connexion - YoTeacher',
                'login.subtitle': 'Connectez-vous à votre espace étudiant',
                'login.email': 'Adresse email',
                'login.email_placeholder': 'votre@email.com',
                'login.password': 'Mot de passe',
                'login.password_placeholder': 'Votre mot de passe',
                'login.forgot_password': 'Mot de passe oublié ?',
                'login.sign_in': 'Se connecter',
                'login.no_account': 'Pas encore de compte ?',
                'login.sign_up_free': 'S\'inscrire gratuitement',
                'login.loading': 'Connexion en cours...',
                'login.success': 'Connexion réussie ! Redirection...',
                
                // Signup page
                'signup.title': 'Inscription - YoTeacher',
                'signup.subtitle': 'Créez votre compte gratuitement',
                'signup.full_name': 'Nom complet',
                'signup.full_name_placeholder': 'Votre nom et prénom',
                'signup.password_hint': 'Minimum 6 caractères',
                'signup.password_placeholder': 'Au moins 6 caractères',
                'signup.confirm_password': 'Confirmer le mot de passe',
                'signup.confirm_password_placeholder': 'Retapez votre mot de passe',
                'signup.create_account': 'Créer mon compte',
                'signup.terms': 'En vous inscrivant, vous acceptez nos Conditions d\'utilisation et Politique de confidentialité',
                'signup.have_account': 'Déjà un compte ?',
                'signup.loading': 'Création du compte...',
                'signup.success': 'Compte créé avec succès !',
                
                // Dashboard page
                'dashboard.title': 'Mon Dashboard - YoTeach',
                'dashboard.loading': 'Chargement...',
                'dashboard.loading_message': 'Veuillez patienter pendant le chargement de votre dashboard.',
                'dashboard.loading_data': 'Chargement de vos données...',
                'dashboard.upcoming_lessons': 'Cours à venir',
                'dashboard.my_credits': 'Mes crédits',
                'dashboard.my_profile': 'Mon Profil',
                'dashboard.no_lessons': 'Aucun cours programmé',
                'dashboard.no_credits': 'Aucun crédit disponible',
                'dashboard.edit_profile': 'Modifier mon profil',
                'dashboard.book_lesson': 'Réserver un cours',
                'dashboard.discover_method': 'Découvrez ma méthode',
                'dashboard.practice_speaking': 'Pratiquez l\'oral',
                'dashboard.complete_learning': 'Apprentissage complet',
                'dashboard.welcome': 'Bienvenue sur votre dashboard YoTeacher',
                'dashboard.email': 'Email',
                'dashboard.member_since': 'Membre depuis',
                'dashboard.time': 'Heure',
                'dashboard.duration': 'Durée',
                'dashboard.type': 'Type',
                'dashboard.reference': 'Référence',
                'dashboard.cancel': 'Annuler',
                'dashboard.reschedule': 'Reporter',
                'dashboard.cancel_confirm': 'Êtes-vous sûr de vouloir annuler ce cours ?',
                'dashboard.cancel_function': 'Fonction d\'annulation à implémenter',
                'dashboard.reschedule_function': 'Fonction de report à implémenter',
                'dashboard.logout': 'Déconnexion',
                'dashboard.my_dashboard': 'Mon tableau de bord',
                'dashboard.my_profile': 'Mon profil',
                
                // Profile page
                'profile.title': 'Mon profil - YoTeacher',
                'profile.change_photo': 'Changer la photo',
                'profile.upload_help': 'JPG, PNG - max 5MB',
                'profile.personal_info': 'Informations',
                'profile.french_level': 'Niveau français',
                'profile.password': 'Mot de passe',
                'profile.personal_subtitle': 'Mettez à jour vos informations de contact',
                'profile.first_name': 'Prénom',
                'profile.last_name': 'Nom',
                'profile.description': 'Description (optionnel)',
                'profile.description_placeholder': 'Parlez-nous un peu de vous...',
                'profile.save_changes': 'Enregistrer les modifications',
                'profile.level_subtitle': 'Définissez votre niveau actuel en français',
                'profile.current_level': 'Niveau actuel (CEFR)',
                'profile.select_level': 'Sélectionnez votre niveau',
                'profile.learning_goals': 'Objectifs d\'apprentissage',
                'profile.goals_placeholder': 'Ex: Préparer le DELF B2, Améliorer mon français professionnel...',
                'profile.save_preferences': 'Enregistrer les préférences',
                'profile.change_password': 'Changer le mot de passe',
                'profile.password_subtitle': 'Mettez à jour votre mot de passe de connexion',
                'profile.current_password': 'Mot de passe actuel',
                'profile.new_password': 'Nouveau mot de passe',
                'profile.password_min': 'Minimum 8 caractères',
                'profile.confirm_password': 'Confirmer le nouveau mot de passe',
                'profile.change_password_button': 'Changer le mot de passe',
                'profile.upload_error': 'La taille de l\'image ne doit pas dépasser 5MB',
                'profile.upload_success': 'Photo mise à jour localement. Sauvegarde cloud à configurer.',
                'profile.upload_error_generic': 'Erreur lors du chargement de l\'image',
                'profile.update_success': 'Profil mis à jour avec succès !',
                'profile.update_error': 'Erreur',
                'profile.level_update_success': 'Niveau de français mis à jour !',
                'profile.password_length_error': 'Le mot de passe doit contenir au moins 8 caractères',
                'profile.password_match_error': 'Les mots de passe ne correspondent pas',
                'profile.password_success': 'Mot de passe mis à jour avec succès !',
                'profile.load_error': 'Erreur lors du chargement du profil',
                
                // Payment page
                'payment.title': 'Paiement - YoTeacher',
                'payment.title_main': 'Finaliser votre paiement',
                'payment.subtitle': 'Choisissez votre moyen de paiement et confirmez votre réservation',
                'payment.currency_info': 'Prix affichés en',
                'payment.auto_conversion': 'Conversion automatique',
                'payment.interac_note': 'Note importante :',
                'payment.interac_message': 'Les paiements Interac doivent être effectués en dollars canadiens (CAD). La devise a été automatiquement ajustée pour vous.',
                'payment.choose_method': 'Choisir un moyen de paiement',
                'payment.revolut_qr': 'Cliquez sur le QR code pour ouvrir Revolut',
                'payment.revolut_link': 'Lien Revolut',
                'payment.beneficiary_name': 'Nom du bénéficiaire',
                'payment.reference': 'Référence',
                'payment.amount': 'Montant',
                'payment.important': 'Important',
                'payment.notice': 'Une fois le paiement effectué',
                'payment.notice2': 'Cliquez sur "J\'ai payé" pour confirmer la réservation.',
                'payment.paid_revolut': 'J\'ai payé avec Revolut',
                'payment.wise_qr': 'Cliquez sur le QR code pour ouvrir Wise',
                'payment.wise_link': 'Lien Wise',
                'payment.wise_email': 'Email Wise',
                'payment.paid_wise': 'J\'ai payé avec Wise',
                'payment.interac_title': 'Paiement Interac',
                'payment.interac_instructions': 'Veuillez effectuer un virement Interac aux coordonnées suivantes :',
                'payment.interac_email': 'Email Interac',
                'payment.security_question': 'Question de sécurité',
                'payment.answer': 'Réponse',
                'payment.interac_notice': 'Une fois le virement effectué, cliquez sur "J\'ai payé avec Interac" pour confirmer votre réservation.',
                'payment.paid_interac': 'J\'ai payé avec Interac',
                'payment.paypal_qr': 'Cliquez sur le QR code pour ouvrir PayPal',
                'payment.paypal_link': 'Lien PayPal',
                'payment.paypal_email': 'Email PayPal',
                'payment.paid_paypal': 'J\'ai payé avec PayPal',
                'payment.card_method': 'Visa/Mastercard/Amex (Stripe)',
                'payment.secure': 'Sécurisé :',
                'payment.secure_message': 'Votre paiement est chiffré et sécurisé par Stripe. Aucune information bancaire n\'est stockée sur nos serveurs.',
                'payment.pay_with_card': 'Payer par carte',
                'payment.summary': 'Récapitulatif',
                'payment.secure_payment': 'Paiement 100% sécurisé',
                'payment.encrypted': 'Vos données bancaires sont chiffrées',
                'payment.no_storage': 'Aucune information stockée sur nos serveurs',
                'payment.guaranteed': 'Réservation garantie après paiement',
                'payment.time_slot': 'Votre créneau est réservé pendant 15 minutes. Une fois le paiement confirmé, vous recevrez un email avec le lien de la visioconférence.',
                'payment.my_dashboard': 'Mon tableau de bord',
                'payment.my_profile': 'Mon profil',
                'payment.my_bookings': 'Mes réservations',
                'payment.currency': 'Devise',
                'payment.booking_details': 'Détails de votre réservation',
                'payment.course_type': 'Type de cours:',
                'payment.date': 'Date:',
                'payment.time': 'Heure:',
                'payment.duration': 'Durée:',
                'payment.platform': 'Plateforme:',
                'payment.total': 'Total à payer:',
                'payment.processing': 'Traitement en cours...',
                'payment.qr_code': 'QR Code',
                
                // Payment success page
                'payment.success_title': 'Paiement Réussi - YoTeacher',
                'payment.success_title_main': 'Paiement Réussi !',
                'payment.success_message': 'Votre paiement a été accepté et votre réservation est en cours de confirmation.',
                'payment.reservation_pending': 'Réservation en attente',
                'payment.technical_issue': 'Votre paiement a été accepté mais nous avons rencontré un problème technique avec la réservation automatique.',
                'payment.contact_me': 'Contactez moi',
                'payment.view_dashboard': 'Voir mon dashboard',
                'payment.return_home': 'Retour à l\'accueil',
                'payment.book_another': 'Réserver un autre cours',
                'payment.reservation_confirmed': 'Réservation confirmée',
                'payment.reservation_error': 'Erreur lors de la réservation. Veuillez me contacter',
                'payment.confirmation_processing': 'Confirmation de réservation en cours...',
                'payment.course': 'Cours:',
                'payment.amount_paid': 'Montant payé:',
                'payment.booking_summary': 'Récapitulatif de votre réservation',
                'payment.details_error1': 'Impossible de récupérer les détails de la réservation.',
                'payment.details_error2': 'Veuillez contacter le support si vous avez des questions.'
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
                'hero.stat4': 'Guided students',
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
                'courses.trial': 'Trial lesson',
                
                // Testimonials
                'testimonials.label': 'Testimonials',
                'testimonials.title': 'What my',
                'testimonials.students': 'students say',
                'testimonials.subtitle': 'Over 500 satisfied students worldwide',
                
                // Testimonials content
                'testimonial.1.name': 'Marina',
                'testimonial.1.country': '🇧🇷 Brazil',
                'testimonial.1.content': 'Yoann is a fantastic teacher! His lessons are dynamic and he really knows how to make me feel at ease. I made incredible progress in just a few months.',
                'testimonial.1.lessons': '42 lessons',
                'testimonial.2.name': 'Kay',
                'testimonial.2.country': '🇺🇸 United States',
                'testimonial.2.content': 'I love learning with Yoann. He is patient, professional and his lessons are always well prepared. He adapts perfectly to my level and my needs.',
                'testimonial.2.lessons': '28 lessons',
                'testimonial.3.name': 'Julia',
                'testimonial.3.country': '🇩🇪 Germany',
                'testimonial.3.content': 'Lessons with Yoann are a real pleasure! He creates a relaxed atmosphere where I am not afraid to make mistakes. My confidence in French has really increased.',
                'testimonial.3.lessons': '15 lessons',
                'testimonial.4.name': 'Octavi',
                'testimonial.4.country': '🇪🇸 Spain',
                'testimonial.4.content': 'Yoann is warm and open-minded. His travels to 75 countries make our conversations very interesting. I highly recommend!',
                'testimonial.4.lessons': '56 lessons',
                'testimonial.5.name': 'Nahéma',
                'testimonial.5.country': '🇨🇦 Canada',
                'testimonial.5.content': 'Thanks to Yoann, I passed my DELF B2 exam! His preparation method is effective and he knows exactly how to prepare you for success.',
                'testimonial.5.lessons': '24 lessons',
                'testimonial.6.name': 'Chen',
                'testimonial.6.country': '🇨🇳 China',
                'testimonial.6.content': 'Very professional and benevolent teacher. He takes the time to explain grammar clearly and the lessons are always lively and dynamic.',
                'testimonial.6.lessons': '37 lessons',
                'testimonial.7.name': 'Luca',
                'testimonial.7.country': '🇮🇹 Italy',
                'testimonial.7.content': 'I am preparing for DELF B1 with Yoann and his advice is valuable. He knows the exam requirements perfectly.',
                'testimonial.7.lessons': '18 lessons',
                'testimonial.8.name': 'Sofia',
                'testimonial.8.country': '🇦🇷 Argentina',
                'testimonial.8.content': 'Lessons with Yoann are always very structured and interesting. I have made a lot of progress in oral comprehension.',
                'testimonial.8.lessons': '32 lessons',
                'testimonial.9.name': 'Ahmed',
                'testimonial.9.country': '🇲🇦 Morocco',
                'testimonial.9.content': 'Exceptional teacher! Yoann knows how to adapt to each student and makes learning French enjoyable.',
                'testimonial.9.lessons': '25 lessons',
                
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
                'footer.email': 'yoteachfr@gmail.com',
                
                // Booking page
                'booking.page_title': 'Book a Course - YoTeacher',
                'booking.title': 'Book a Course',
                'booking.subtitle': 'Choose the date, time and type of course that suits you',
                'booking.choose_slot': 'Choose a Time Slot',
                'booking.details': 'Booking Details',
                'booking.available_slots': 'Available Slots',
                'booking.loading_slots': 'Loading time slots...',
                'booking.no_slots': 'No time slots available for this date.',
                'booking.no_future_slots': 'All time slots are full for today.',
                'booking.error_loading': 'Error loading time slots',
                'booking.retry': 'Try again',
                'booking.course_type': 'Course Type',
                'booking.select_course': 'Select a course type',
                'booking.duration': 'Course Duration',
                'booking.courses_count': 'Number of Courses',
                'booking.one_course': '1 course',
                'booking.five_courses': '5 courses',
                'booking.ten_courses': '10 courses',
                'booking.discount_badge': '-2%',
                'booking.discount_badge_5': '-5%',
                'booking.communication': 'Communication Method',
                'booking.zoom': 'Zoom',
                'booking.teams': 'Teams',
                'booking.meet': 'Meet',
                'booking.full_name': 'Full Name',
                'booking.email': 'Email',
                'booking.notes': 'Notes for the teacher (optional)',
                'booking.notes_placeholder': 'Your level, goals, favorite discussion topics...',
                'booking.summary': 'Summary',
                'booking.summary_type': 'Course Type:',
                'booking.summary_courses': 'Number of Courses:',
                'booking.courses': 'courses',
                'booking.summary_discount': 'Discount:',
                'booking.summary_date': 'Date:',
                'booking.summary_time': 'Time:',
                'booking.summary_duration': 'Duration:',
                'booking.summary_platform': 'Platform:',
                'booking.summary_total': 'Total:',
                'booking.book_and_pay': 'Book and Pay',
                'booking.payment_redirect': 'You will be redirected to the payment page after confirmation',
                'booking.login_required': 'To book a',
                'booking.connect': 'log in',
                'booking.or': 'or',
                'booking.create_account': 'create an account',
                
                // Login page
                'login.title': 'Login - YoTeacher',
                'login.subtitle': 'Log in to your student space',
                'login.email': 'Email address',
                'login.email_placeholder': 'your@email.com',
                'login.password': 'Password',
                'login.password_placeholder': 'Your password',
                'login.forgot_password': 'Forgot password?',
                'login.sign_in': 'Log in',
                'login.no_account': 'No account yet?',
                'login.sign_up_free': 'Sign up for free',
                'login.loading': 'Logging in...',
                'login.success': 'Login successful! Redirecting...',
                
                // Signup page
                'signup.title': 'Sign Up - YoTeacher',
                'signup.subtitle': 'Create your account for free',
                'signup.full_name': 'Full name',
                'signup.full_name_placeholder': 'Your full name',
                'signup.password_hint': 'Minimum 6 characters',
                'signup.password_placeholder': 'At least 6 characters',
                'signup.confirm_password': 'Confirm password',
                'signup.confirm_password_placeholder': 'Re-enter your password',
                'signup.create_account': 'Create my account',
                'signup.terms': 'By signing up, you agree to our Terms of Use and Privacy Policy',
                'signup.have_account': 'Already have an account?',
                'signup.loading': 'Creating account...',
                'signup.success': 'Account created successfully!',
                
                // Dashboard page
                'dashboard.title': 'My Dashboard - YoTeach',
                'dashboard.loading': 'Loading...',
                'dashboard.loading_message': 'Please wait while your dashboard is loading.',
                'dashboard.loading_data': 'Loading your data...',
                'dashboard.upcoming_lessons': 'Upcoming lessons',
                'dashboard.my_credits': 'My credits',
                'dashboard.my_profile': 'My Profile',
                'dashboard.no_lessons': 'No lessons scheduled',
                'dashboard.no_credits': 'No credits available',
                'dashboard.edit_profile': 'Edit my profile',
                'dashboard.book_lesson': 'Book a lesson',
                'dashboard.discover_method': 'Discover my method',
                'dashboard.practice_speaking': 'Practice speaking',
                'dashboard.complete_learning': 'Complete learning',
                'dashboard.welcome': 'Welcome to your YoTeacher dashboard',
                'dashboard.email': 'Email',
                'dashboard.member_since': 'Member since',
                'dashboard.time': 'Time',
                'dashboard.duration': 'Duration',
                'dashboard.type': 'Type',
                'dashboard.reference': 'Reference',
                'dashboard.cancel': 'Cancel',
                'dashboard.reschedule': 'Reschedule',
                'dashboard.cancel_confirm': 'Are you sure you want to cancel this lesson?',
                'dashboard.cancel_function': 'Cancel function to implement',
                'dashboard.reschedule_function': 'Reschedule function to implement',
                'dashboard.logout': 'Logout',
                'dashboard.my_dashboard': 'My dashboard',
                'dashboard.my_profile': 'My profile',
                
                // Profile page
                'profile.title': 'My Profile - YoTeacher',
                'profile.change_photo': 'Change photo',
                'profile.upload_help': 'JPG, PNG - max 5MB',
                'profile.personal_info': 'Information',
                'profile.french_level': 'French level',
                'profile.password': 'Password',
                'profile.personal_subtitle': 'Update your contact information',
                'profile.first_name': 'First name',
                'profile.last_name': 'Last name',
                'profile.description': 'Description (optional)',
                'profile.description_placeholder': 'Tell us a bit about yourself...',
                'profile.save_changes': 'Save changes',
                'profile.level_subtitle': 'Define your current French level',
                'profile.current_level': 'Current level (CEFR)',
                'profile.select_level': 'Select your level',
                'profile.learning_goals': 'Learning goals',
                'profile.goals_placeholder': 'Ex: Prepare for DELF B2, Improve my professional French...',
                'profile.save_preferences': 'Save preferences',
                'profile.change_password': 'Change password',
                'profile.password_subtitle': 'Update your login password',
                'profile.current_password': 'Current password',
                'profile.new_password': 'New password',
                'profile.password_min': 'Minimum 8 characters',
                'profile.confirm_password': 'Confirm new password',
                'profile.change_password_button': 'Change password',
                'profile.upload_error': 'Image size should not exceed 5MB',
                'profile.upload_success': 'Photo updated locally. Cloud save to configure.',
                'profile.upload_error_generic': 'Error loading image',
                'profile.update_success': 'Profile updated successfully!',
                'profile.update_error': 'Error',
                'profile.level_update_success': 'French level updated!',
                'profile.password_length_error': 'Password must be at least 8 characters long',
                'profile.password_match_error': 'Passwords do not match',
                'profile.password_success': 'Password updated successfully!',
                'profile.load_error': 'Error loading profile',
                
                // Payment page
                'payment.title': 'Payment - YoTeacher',
                'payment.title_main': 'Complete your payment',
                'payment.subtitle': 'Choose your payment method and confirm your reservation',
                'payment.currency_info': 'Prices displayed in',
                'payment.auto_conversion': 'Automatic conversion',
                'payment.interac_note': 'Important note:',
                'payment.interac_message': 'Interac payments must be made in Canadian dollars (CAD). The currency has been automatically adjusted for you.',
                'payment.choose_method': 'Choose a payment method',
                'payment.revolut_qr': 'Click on the QR code to open Revolut',
                'payment.revolut_link': 'Revolut link',
                'payment.beneficiary_name': 'Beneficiary name',
                'payment.reference': 'Reference',
                'payment.amount': 'Amount',
                'payment.important': 'Important:',
                'payment.revolut_notice': 'Once payment is made on Revolut, click "I paid with Revolut" to confirm your reservation.',
                'payment.paid_revolut': 'I paid with Revolut',
                'payment.wise_qr': 'Click on the QR code to open Wise',
                'payment.wise_link': 'Wise link',
                'payment.wise_email': 'Wise email',
                'payment.wise_notice': 'Once payment is made on Wise, click "I paid with Wise" to confirm your reservation.',
                'payment.paid_wise': 'I paid with Wise',
                'payment.interac_title': 'Interac Payment',
                'payment.interac_instructions': 'Please send an Interac transfer to the following details:',
                'payment.interac_email': 'Interac email',
                'payment.security_question': 'Security question',
                'payment.answer': 'Answer',
                'payment.interac_notice': 'Once the transfer is made, click "I paid with Interac" to confirm your reservation.',
                'payment.paid_interac': 'I paid with Interac',
                'payment.paypal_qr': 'Click on the QR code to open PayPal',
                'payment.paypal_link': 'PayPal link',
                'payment.paypal_email': 'PayPal email',
                'payment.paypal_notice': 'Once payment is made on PayPal, click "I paid with PayPal" to confirm your reservation.',
                'payment.paid_paypal': 'I paid with PayPal',
                'payment.card_method': 'Visa/Mastercard/Amex (Stripe)',
                'payment.secure': 'Secure:',
                'payment.secure_message': 'Your payment is encrypted and secured by Stripe. No banking information is stored on our servers.',
                'payment.pay_with_card': 'Pay with card',
                'payment.summary': 'Summary',
                'payment.secure_payment': '100% secure payment',
                'payment.encrypted': 'Your banking data is encrypted',
                'payment.no_storage': 'No information stored on our servers',
                'payment.guaranteed': 'Reservation guaranteed after payment',
                'payment.time_slot': 'Your time slot is reserved for 15 minutes. Once payment is confirmed, you will receive an email with the video conference link.',
                'payment.my_dashboard': 'My dashboard',
                'payment.my_profile': 'My profile',
                'payment.my_bookings': 'My bookings',
                'payment.currency': 'Currency',
                'payment.booking_details': 'Your booking details',
                'payment.course_type': 'Course type:',
                'payment.date': 'Date:',
                'payment.time': 'Time:',
                'payment.duration': 'Duration:',
                'payment.platform': 'Platform:',
                'payment.total': 'Total to pay:',
                'payment.processing': 'Processing...',
                'payment.qr_code': 'QR Code',
                
                // Payment success page
                'payment.success_title': 'Payment Successful - YoTeacher',
                'payment.success_title_main': 'Payment Successful!',
                'payment.success_message': 'Your payment has been accepted and your reservation is being confirmed.',
                'payment.reservation_pending': 'Reservation pending',
                'payment.technical_issue': 'Your payment has been accepted but we encountered a technical issue with the automatic reservation.',
                'payment.contact_me': 'Contact me',
                'payment.view_dashboard': 'View my dashboard',
                'payment.return_home': 'Return to home',
                'payment.book_another': 'Book another course',
                'payment.reservation_confirmed': 'Reservation confirmed',
                'payment.reservation_error': 'Reservation error. Please contact me',
                'payment.confirmation_processing': 'Reservation confirmation in progress...',
                'payment.course': 'Course:',
                'payment.amount_paid': 'Amount paid:',
                'payment.booking_summary': 'Your booking summary',
                'payment.details_error1': 'Unable to retrieve booking details.',
                'payment.details_error2': 'Please contact support if you have any questions.'
            }
        };
        
        this.initialize();
    }

    initialize() {
        const savedLanguage = localStorage.getItem('language');
        
        if (savedLanguage && this.supportedLanguages.includes(savedLanguage)) {
            this.currentLanguage = savedLanguage;
        } else {
            const browserLanguage = navigator.language.split('-')[0];
            if (this.supportedLanguages.includes(browserLanguage)) {
                this.currentLanguage = browserLanguage;
            }
        }
        
        console.log(`🌍 Langue initiale: ${this.currentLanguage}`);
        
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
        
        this.updatePage();
        this.addEventListeners();
    }

    addEventListeners() {
        console.log('🌍 Ajout des écouteurs d\'événements...');
        
        const desktopSwitcher = document.getElementById('languageSwitcherDesktop');
        if (desktopSwitcher) {
            desktopSwitcher.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🌍 Clic sur le sélecteur de langue desktop');
                this.toggleLanguage();
            });
        }
        
        const mobileSwitcher = document.getElementById('languageSwitcherMobile');
        if (mobileSwitcher) {
            mobileSwitcher.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🌍 Clic sur le sélecteur de langue mobile');
                this.toggleLanguage();
                
                const mobileMenu = document.getElementById('mobileMenu');
                if (mobileMenu && mobileMenu.classList.contains('active')) {
                    mobileMenu.classList.remove('active');
                }
            });
        }
        
        console.log('✅ Écouteurs d\'événements ajoutés');
    }

    toggleLanguage() {
        this.currentLanguage = this.currentLanguage === 'fr' ? 'en' : 'fr';
        localStorage.setItem('language', this.currentLanguage);
        
        console.log(`🌍 Changement de langue vers: ${this.currentLanguage}`);
        
        this.updatePage();
        
        window.dispatchEvent(new CustomEvent('language:changed', { 
            detail: { language: this.currentLanguage } 
        }));
    }

    updatePage() {
        console.log(`🌍 Mise à jour de la page en ${this.currentLanguage}`);
        
        document.documentElement.lang = this.currentLanguage;
        this.applyTranslations();
        this.updateLanguageSwitchers();
        
        console.log('✅ Page traduite avec succès');
    }

    applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getTranslation(key);
            if (translation && translation !== key) {
                element.textContent = translation;
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.getTranslation(key);
            if (translation && translation !== key) {
                element.placeholder = translation;
            }
        });

        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.getTranslation(key);
            if (translation && translation !== key) {
                element.title = translation;
            }
        });
        
        // Mettre à jour les titres de page
        const titleElement = document.querySelector('title[data-i18n]');
        if (titleElement) {
            const key = titleElement.getAttribute('data-i18n');
            const translation = this.getTranslation(key);
            if (translation && translation !== key) {
                titleElement.textContent = translation;
            }
        }
        
        // Mettre à jour les titres de page sans attribut data-i18n
        const title = document.querySelector('title');
        if (title && !title.hasAttribute('data-i18n')) {
            const currentPath = window.location.pathname;
            let pageKey = '';
            
            if (currentPath.includes('booking.html')) {
                pageKey = 'booking.page_title';
            } else if (currentPath.includes('login.html')) {
                pageKey = 'login.title';
            } else if (currentPath.includes('signup.html')) {
                pageKey = 'signup.title';
            } else if (currentPath.includes('dashboard.html')) {
                pageKey = 'dashboard.title';
            } else if (currentPath.includes('profile.html')) {
                pageKey = 'profile.title';
            } else if (currentPath.includes('payment.html')) {
                pageKey = 'payment.title';
            }
            
            if (pageKey) {
                const translation = this.getTranslation(pageKey);
                if (translation && translation !== pageKey) {
                    title.textContent = translation;
                }
            }
        }
    }

    updateLanguageSwitchers() {
        const languageSwitchers = document.querySelectorAll('.language-switcher span:last-child, .mobile-language span:last-child');
        
        languageSwitchers.forEach(switcher => {
            switcher.textContent = this.currentLanguage === 'fr' ? 'EN' : 'FR';
            
            const parent = switcher.closest('.language-switcher, .mobile-language');
            if (parent) {
                parent.title = this.currentLanguage === 'fr' 
                    ? 'Switch to English' 
                    : 'Passer en Français';
            }
        });
    }

    getTranslation(key) {
        if (this.translations[this.currentLanguage] && this.translations[this.currentLanguage][key]) {
            return this.translations[this.currentLanguage][key];
        }
        
        if (this.translations['fr'] && this.translations['fr'][key]) {
            return this.translations['fr'][key];
        }
        
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