// translation.js - Version corrigée
class TranslationManager {
    constructor() {
        this.currentLanguage = 'fr';
        this.supportedLanguages = ['fr', 'en'];
        this.translations = {
            fr: {
                // Header
                'header.logo': 'Yoann',
                'header.language': 'EN',
                'header.login': 'Connexion',

                // Page légale
                'legal.title': 'Mentions Légales - YoTeach',
                'legal.intro': 'Informations légales, conditions de vente et politiques de YoTeach',
                'legal.nav.mentions': 'Mentions Légales',
                'legal.nav.conditions': 'Conditions de Vente',
                'legal.nav.privacy': 'Confidentialité',
                'legal.nav.cancellation': 'Annulation',
                'legal.back_to_top': '↑ Retour en haut',

                // Section 1 - Mentions Légales
                'legal.section1.title': 'Mentions Légales',
                'legal.section1.editor.title': 'Éditeur du site',
                'legal.section1.editor.name': 'YoTeach',
                'legal.section1.editor.description': '- Cours de français en ligne',
                'legal.section1.editor.teacher_label': 'Professeur :',
                'legal.section1.editor.teacher_name': 'Yoann Bourbia',
                'legal.section1.editor.email_label': 'Email :',
                'legal.section1.editor.email': 'yoteachfr@gmail.com',
                'legal.section1.editor.location_label': 'Localisation :',
                'legal.section1.editor.location': 'Marseille, France',
                'legal.section1.activity.title': 'Activité',
                'legal.section1.activity.line1': 'Enseignement de la langue française en ligne à destination des adultes.',
                'legal.section1.activity.line2': 'Cours particuliers et personnalisés via visioconférence.',
                'legal.section1.intellectual.title': 'Propriété intellectuelle',
                'legal.section1.intellectual.content': 'L\'ensemble du contenu de ce site (textes, images, design, logos) est la propriété exclusive de YoTeach, sauf mention contraire. Toute reproduction, même partielle, est interdite sans autorisation écrite préalable.',
                'legal.section1.responsibility.title': 'Responsabilité',
                'legal.section1.responsibility.content': 'YoTeach met tout en œuvre pour assurer l\'exactitude des informations diffusées sur son site. Cependant, YoTeach ne saurait être tenue responsable des erreurs, omissions, ou des résultats qui pourraient être obtenus par l\'usage de ces informations.',

                // Section 2 - Conditions Générales de Vente
                'legal.section2.title': 'Conditions Générales de Vente',
                'legal.section2.article1.title': 'Article 1 - Objet',
                'legal.section2.article1.content': 'Les présentes conditions générales de vente (CGV) ont pour objet de définir les relations contractuelles entre YoTeach et l\'acheteur, ainsi que les conditions de vente des cours de français en ligne.',
                'legal.section2.article2.title': 'Article 2 - Prix',
                'legal.section2.article2.content': 'Les prix des cours sont indiqués en euros (€) si aucune conversion automatique n\'est faite. YoTeach se réserve le droit de modifier ses tarifs à tout moment, étant entendu que le prix applicable à la commande est celui en vigueur au jour de la commande.',
                'legal.section2.article3.title': 'Article 3 - Commande et Paiement',
                'legal.section2.article3.intro': 'La commande de cours s\'effectue en ligne via le site YoTeach. Le paiement est exigible immédiatement à la commande. Les moyens de paiement acceptés sont :',
                'legal.section2.article3.payment1': 'Cartes bancaires (via Stripe)',
                'legal.section2.article3.payment2': 'Revolut',
                'legal.section2.article3.payment3': 'Wise',
                'legal.section2.article3.payment4': 'PayPal',
                'legal.section2.article3.payment5': 'Interac (Canada)',
                'legal.section2.article4.title': 'Article 4 - Validation de la commande',
                'legal.section2.article4.content': 'La commande ne sera considérée comme définitive qu\'après réception du paiement complet. Une confirmation de commande sera envoyée par email à l\'adresse fournie par l\'acheteur.',
                'legal.section2.article5.title': 'Article 5 - Prestation de service',
                'legal.section2.article5.content1': 'Les cours sont dispensés en visioconférence via Zoom, Google Meet ou Microsoft Teams, selon le choix de l\'élève. L\'élève recevra le lien de connexion par email avant chaque séance.',
                'legal.section2.article5.content2': 'YoTeach s\'engage à respecter les horaires convenus et à fournir un service de qualité correspondant à la description des cours sur le site.',
                'legal.section2.article6.title': 'Article 6 - Droit de rétractation',
                'legal.section2.article6.content': 'Conformément à l\'article L.221-28 du Code de la consommation, le droit de rétractation ne s\'applique pas aux contrats de prestation de services pleinement exécutés avant la fin du délai de rétractation. Les cours réservés et payés ne peuvent donc pas être remboursés, sauf dans les conditions prévues à l\'article 7.',
                'legal.section2.article7.title': 'Article 7 - Annulation et report',
                'legal.section2.article7.content': 'L\'élève peut annuler ou reporter un cours sans frais jusqu\'à 24 heures avant l\'horaire prévu. Au-delà de ce délai, le cours est dû intégralement. En cas d\'absence non excusée, le cours est également dû intégralement.',
                'legal.section2.article8.title': 'Article 8 - Propriété intellectuelle',
                'legal.section2.article8.content': 'Les supports de cours fournis par YoTeach (documents, exercices, enregistrements) sont protégés par le droit d\'auteur et sont destinés à un usage personnel uniquement. Toute diffusion, reproduction ou exploitation commerciale est interdite.',
                'legal.section2.article9.title': 'Article 9 - Protection des données personnelles',
                'legal.section2.article9.content': 'Les données personnelles collectées sont traitées conformément à notre Politique de confidentialité. L\'élève dispose d\'un droit d\'accès, de rectification et de suppression de ses données.',

                // Section 3 - Politique de Confidentialité
                'legal.section3.title': 'Politique de Confidentialité',
                'legal.section3.data1.title': '1. Données collectées',
                'legal.section3.data1.intro': 'Nous collectons les données suivantes :',
                'legal.section3.data1.type1': 'Identité :',
                'legal.section3.data1.detail1': 'Nom, prénom, email',
                'legal.section3.data1.type2': 'Paiement :',
                'legal.section3.data1.detail2': 'Informations de transaction (gardées par nos processeurs de paiement)',
                'legal.section3.data1.type3': 'Apprentissage :',
                'legal.section3.data1.detail3': 'Niveau de français, objectifs, notes sur les cours',
                'legal.section3.data1.type4': 'Communication :',
                'legal.section3.data1.detail4': 'Historique des échanges par email',
                'legal.section3.purposes.title': '2. Finalités du traitement',
                'legal.section3.purposes.intro': 'Vos données sont utilisées pour :',
                'legal.section3.purposes.purpose1': 'Gérer votre compte étudiant',
                'legal.section3.purposes.purpose2': 'Planifier et dispenser vos cours',
                'legal.section3.purposes.purpose3': 'Traiter vos paiements',
                'legal.section3.purposes.purpose4': 'Vous envoyer des informations sur vos cours',
                'legal.section3.purposes.purpose5': 'Améliorer nos services',
                'legal.section3.basis.title': '3. Base légale',
                'legal.section3.basis.intro': 'Le traitement de vos données est basé sur :',
                'legal.section3.basis.basis1': 'L\'exécution du contrat (cours que vous réservez)',
                'legal.section3.basis.basis2': 'L\'intérêt légitime (amélioration des services, sécurité)',
                'legal.section3.retention.title': '4. Conservation des données',
                'legal.section3.retention.intro': 'Vos données sont conservées :',
                'legal.section3.retention.retention1': 'Données de compte : 3 ans après la dernière activité',
                'legal.section3.retention.retention2': 'Données de facturation : 10 ans (obligation légale)',
                'legal.section3.retention.retention3': 'Données de cours : 5 ans après le dernier cours',
                'legal.section3.sharing.title': '5. Partage des données',
                'legal.section3.sharing.intro': 'Vos données ne sont partagées qu\'avec :',
                'legal.section3.sharing.share1': 'Nos processeurs de paiement (Stripe, PayPal, etc.)',
                'legal.section3.sharing.share2': 'Nos outils de visioconférence (Zoom, etc.)',
                'legal.section3.sharing.share3': 'Nos sous-traitants techniques (hébergeur, email)',
                'legal.section3.sharing.note': 'Aucune donnée n\'est vendue à des tiers.',
                'legal.section3.security.title': '6. Sécurité',
                'legal.section3.security.content': 'Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction.',
                'legal.section3.rights.title': '7. Vos droits',
                'legal.section3.rights.intro': 'Vous disposez des droits suivants :',
                'legal.section3.rights.right1': 'Droit d\'accès à vos données',
                'legal.section3.rights.right2': 'Droit de rectification',
                'legal.section3.rights.right3': 'Droit à l\'effacement ("droit à l\'oubli")',
                'legal.section3.rights.right4': 'Droit à la limitation du traitement',
                'legal.section3.rights.right5': 'Droit à la portabilité des données',
                'legal.section3.rights.right6': 'Droit d\'opposition',
                'legal.section3.rights.contact': 'Pour exercer ces droits, contactez-nous à : yoteachfr@gmail.com',
                'legal.section3.cookies.title': '8. Cookies',
                'legal.section3.cookies.content': 'Notre site utilise des cookies techniques essentiels au fonctionnement. Aucun cookie de tracking n\'est utilisé.',

                // Section 4 - Politique d'Annulation
                'legal.section4.title': 'Politique d\'Annulation',
                'legal.section4.cancellation1.title': '1. Annulation par l\'élève',
                'legal.section4.cancellation1.intro': 'L\'élève peut annuler un cours sans frais jusqu\'à <strong>24 heures</strong> avant l\'horaire prévu. Pour annuler :',
                'legal.section4.cancellation1.time': '24 heures',
                'legal.section4.cancellation1.method1': 'Via votre dashboard YoTeach',
                'legal.section4.cancellation1.method2': 'Par email à yoteachfr@gmail.com',
                'legal.section4.cancellation2.title': '2. Retard dans l\'annulation',
                'legal.section4.cancellation2.intro': 'Si l\'annulation intervient moins de 24 heures avant le cours :',
                'legal.section4.cancellation2.consequence1': 'Le cours est dû à 100%',
                'legal.section4.cancellation2.consequence2': 'Aucun remboursement n\'est effectué',
                'legal.section4.cancellation2.consequence3': 'Le crédit est consommé',
                'legal.section4.absence.title': '3. Absence non excusée',
                'legal.section4.absence.intro': 'En cas d\'absence sans annulation préalable :',
                'legal.section4.absence.consequence1': 'Le cours est dû à 100%',
                'legal.section4.absence.consequence2': 'Le professeur attend 10 minutes avant de considérer le cours comme annulé',
                'legal.section4.absence.consequence3': 'Aucun report automatique n\'est effectué',
                'legal.section4.cancellation3.title': '4. Annulation par le professeur',
                'legal.section4.cancellation3.intro': 'Dans le cas exceptionnel où le professeur doit annuler un cours :',
                'legal.section4.cancellation3.consequence1': 'L\'élève est prévenu au plus tôt par email',
                'legal.section4.cancellation3.consequence2': 'Le cours est reporté à une date convenue mutuellement',
                'legal.section4.cancellation3.consequence3': 'Le crédit est conservé pour la nouvelle date',
                'legal.section4.cancellation3.consequence4': 'En cas d\'impossibilité de report, un remboursement est effectué',
                'legal.section4.reschedule.title': '5. Report de cours',
                'legal.section4.reschedule.intro': 'Le report est possible jusqu\'à 24 heures avant le cours, sous réserve de disponibilité du professeur. Pour reporter :',
                'legal.section4.reschedule.method1': 'Utilisez la fonction "Annuler" dans votre dashboard',
                'legal.section4.reschedule.method2': 'Un crédit vous est attribué automatiquement',
                'legal.section4.reschedule.method3': 'Réserver un nouveau créneau en utilisant votre crédit',
                'legal.section4.packages.title': '6. Forfaits de cours',
                'legal.section4.packages.intro': 'Pour les forfaits de 5 ou 10 cours :',
                'legal.section4.packages.rule1': 'Les crédits sont valables 3 mois à partir de la date d\'achat',
                'legal.section4.packages.rule2': 'Les annulations tardives consomment un crédit',
                'legal.section4.packages.rule3': 'Les crédits non utilisés expirent sans remboursement',
                'legal.section4.trial.title': '7. Cours d\'essai',
                'legal.section4.trial.content': 'Le cours d\'essai à 5€ suit les mêmes règles d\'annulation. En cas d\'annulation tardive ou d\'absence, le montant n\'est pas remboursé.',
                'legal.section4.refunds.title': '8. Remboursements',
                'legal.section4.refunds.intro': 'Les remboursements sont effectués selon les modalités suivantes :',
                'legal.section4.refunds.method1': 'Via le même moyen de paiement que l\'achat initial',
                'legal.section4.refunds.method2': 'Sous 14 jours ouvrables maximum',
                'legal.section4.refunds.method3': 'Les frais de transaction peuvent être déduits'
            },
            en: {
                // Header
                'header.logo': 'Yoann',
                'header.language': 'FR',
                'header.login': 'Login',

                // Legal page
                'legal.title': 'Legal Notice - YoTeach',
                'legal.intro': 'Legal information, terms of sale and policies of YoTeach',
                'legal.nav.mentions': 'Legal Notice',
                'legal.nav.conditions': 'Terms and Conditions',
                'legal.nav.privacy': 'Privacy',
                'legal.nav.cancellation': 'Cancellation',
                'legal.back_to_top': '↑ Back to top',

                // Section 1 - Legal Notice
                'legal.section1.title': 'Legal Notice',
                'legal.section1.editor.title': 'Website Editor',
                'legal.section1.editor.name': 'YoTeach',
                'legal.section1.editor.description': '- Online French courses',
                'legal.section1.editor.teacher_label': 'Teacher:',
                'legal.section1.editor.teacher_name': 'Yoann Bourbia',
                'legal.section1.editor.email_label': 'Email:',
                'legal.section1.editor.email': 'yoteachfr@gmail.com',
                'legal.section1.editor.location_label': 'Location:',
                'legal.section1.editor.location': 'Marseille, France',
                'legal.section1.activity.title': 'Activity',
                'legal.section1.activity.line1': 'Teaching French online for adults.',
                'legal.section1.activity.line2': 'Private and personalized lessons via video conference.',
                'legal.section1.intellectual.title': 'Intellectual Property',
                'legal.section1.intellectual.content': 'All content on this website (texts, images, design, logos) is the exclusive property of YoTeach, unless otherwise stated. Any reproduction, even partial, is prohibited without prior written permission.',
                'legal.section1.responsibility.title': 'Responsibility',
                'legal.section1.responsibility.content': 'YoTeach makes every effort to ensure the accuracy of the information published on its website. However, YoTeach cannot be held responsible for errors, omissions, or results that may be obtained through the use of this information.',

                // Section 2 - Terms and Conditions
                'legal.section2.title': 'Terms and Conditions',
                'legal.section2.article1.title': 'Article 1 - Purpose',
                'legal.section2.article1.content': 'These general terms and conditions (GTC) aim to define the contractual relationship between YoTeach and the buyer, as well as the conditions for the sale of online French courses.',
                'legal.section2.article2.title': 'Article 2 - Prices',
                'legal.section2.article2.content': 'Course prices are indicated in euros (€) unless automatic conversion is applied. YoTeach reserves the right to modify its prices at any time, it being understood that the price applicable to the order is the one in force on the day of the order.',
                'legal.section2.article3.title': 'Article 3 - Order and Payment',
                'legal.section2.article3.intro': 'Course orders are made online via the YoTeach website. Payment is due immediately upon ordering. Accepted payment methods are:',
                'legal.section2.article3.payment1': 'Credit cards (via Stripe)',
                'legal.section2.article3.payment2': 'Revolut',
                'legal.section2.article3.payment3': 'Wise',
                'legal.section2.article3.payment4': 'PayPal',
                'legal.section2.article3.payment5': 'Interac (Canada)',
                'legal.section2.article4.title': 'Article 4 - Order Validation',
                'legal.section2.article4.content': 'The order will only be considered final after receipt of full payment. An order confirmation will be sent by email to the address provided by the buyer.',
                'legal.section2.article5.title': 'Article 5 - Service Provision',
                'legal.section2.article5.content1': 'Lessons are delivered via video conference through Zoom, Google Meet or Microsoft Teams, according to the student\'s choice. The student will receive the connection link by email before each session.',
                'legal.section2.article5.content2': 'YoTeach undertakes to respect the agreed schedules and to provide a quality service corresponding to the description of the courses on the website.',
                'legal.section2.article6.title': 'Article 6 - Right of Withdrawal',
                'legal.section2.article6.content': 'In accordance with article L.221-28 of the Consumer Code, the right of withdrawal does not apply to contracts for services fully performed before the end of the withdrawal period. Therefore, courses booked and paid for cannot be refunded, except under the conditions provided for in Article 7.',
                'legal.section2.article7.title': 'Article 7 - Cancellation and Rescheduling',
                'legal.section2.article7.content': 'The student can cancel or reschedule a course free of charge up to 24 hours before the scheduled time. Beyond this deadline, the course is due in full. In case of unexcused absence, the course is also due in full.',
                'legal.section2.article8.title': 'Article 8 - Intellectual Property',
                'legal.section2.article8.content': 'Course materials provided by YoTeach (documents, exercises, recordings) are protected by copyright and are intended for personal use only. Any distribution, reproduction or commercial exploitation is prohibited.',
                'legal.section2.article9.title': 'Article 9 - Personal Data Protection',
                'legal.section2.article9.content': 'Personal data collected is processed in accordance with our Privacy Policy. The student has the right to access, rectify and delete their data.',

                // Section 3 - Privacy Policy
                'legal.section3.title': 'Privacy Policy',
                'legal.section3.data1.title': '1. Data Collected',
                'legal.section3.data1.intro': 'We collect the following data:',
                'legal.section3.data1.type1': 'Identity:',
                'legal.section3.data1.detail1': 'Name, first name, email',
                'legal.section3.data1.type2': 'Payment:',
                'legal.section3.data1.detail2': 'Transaction information (kept by our payment processors)',
                'legal.section3.data1.type3': 'Learning:',
                'legal.section3.data1.detail3': 'French level, goals, course notes',
                'legal.section3.data1.type4': 'Communication:',
                'legal.section3.data1.detail4': 'Email exchange history',
                'legal.section3.purposes.title': '2. Purposes of Processing',
                'legal.section3.purposes.intro': 'Your data is used for:',
                'legal.section3.purposes.purpose1': 'Managing your student account',
                'legal.section3.purposes.purpose2': 'Scheduling and delivering your courses',
                'legal.section3.purposes.purpose3': 'Processing your payments',
                'legal.section3.purposes.purpose4': 'Sending you information about your courses',
                'legal.section3.purposes.purpose5': 'Improving our services',
                'legal.section3.basis.title': '3. Legal Basis',
                'legal.section3.basis.intro': 'The processing of your data is based on:',
                'legal.section3.basis.basis1': 'Performance of the contract (courses you book)',
                'legal.section3.basis.basis2': 'Legitimate interest (service improvement, security)',
                'legal.section3.retention.title': '4. Data Retention',
                'legal.section3.retention.intro': 'Your data is retained for:',
                'legal.section3.retention.retention1': 'Account data: 3 years after last activity',
                'legal.section3.retention.retention2': 'Billing data: 10 years (legal requirement)',
                'legal.section3.retention.retention3': 'Course data: 5 years after the last course',
                'legal.section3.sharing.title': '5. Data Sharing',
                'legal.section3.sharing.intro': 'Your data is only shared with:',
                'legal.section3.sharing.share1': 'Our payment processors (Stripe, PayPal, etc.)',
                'legal.section3.sharing.share2': 'Our video conferencing tools (Zoom, etc.)',
                'legal.section3.sharing.share3': 'Our technical subcontractors (hosting, email)',
                'legal.section3.sharing.note': 'No data is sold to third parties.',
                'legal.section3.security.title': '6. Security',
                'legal.section3.security.content': 'We implement appropriate technical and organizational measures to protect your data against unauthorized access, modification, disclosure or destruction.',
                'legal.section3.rights.title': '7. Your Rights',
                'legal.section3.rights.intro': 'You have the following rights:',
                'legal.section3.rights.right1': 'Right to access your data',
                'legal.section3.rights.right2': 'Right to rectification',
                'legal.section3.rights.right3': 'Right to erasure ("right to be forgotten")',
                'legal.section3.rights.right4': 'Right to restriction of processing',
                'legal.section3.rights.right5': 'Right to data portability',
                'legal.section3.rights.right6': 'Right to object',
                'legal.section3.rights.contact': 'To exercise these rights, contact us at: yoteachfr@gmail.com',
                'legal.section3.cookies.title': '8. Cookies',
                'legal.section3.cookies.content': 'Our website uses technical cookies essential for operation. No tracking cookies are used.',

                // Section 4 - Cancellation Policy
                'legal.section4.title': 'Cancellation Policy',
                'legal.section4.cancellation1.title': '1. Cancellation by Student',
                'legal.section4.cancellation1.intro': 'The student can cancel a course free of charge up to <strong>24 hours</strong> before the scheduled time. To cancel:',
                'legal.section4.cancellation1.time': '24 hours',
                'legal.section4.cancellation1.method1': 'Via your YoTeach dashboard',
                'legal.section4.cancellation1.method2': 'By email at yoteachfr@gmail.com',
                'legal.section4.cancellation2.title': '2. Late Cancellation',
                'legal.section4.cancellation2.intro': 'If cancellation occurs less than 24 hours before the course:',
                'legal.section4.cancellation2.consequence1': 'The course is due at 100%',
                'legal.section4.cancellation2.consequence2': 'No refund is made',
                'legal.section4.cancellation2.consequence3': 'The credit is consumed',
                'legal.section4.absence.title': '3. Unexcused Absence',
                'legal.section4.absence.intro': 'In case of absence without prior cancellation:',
                'legal.section4.absence.consequence1': 'The course is due at 100%',
                'legal.section4.absence.consequence2': 'The teacher waits 10 minutes before considering the course canceled',
                'legal.section4.absence.consequence3': 'No automatic rescheduling is done',
                'legal.section4.cancellation3.title': '4. Cancellation by Teacher',
                'legal.section4.cancellation3.intro': 'In the exceptional case where the teacher must cancel a course:',
                'legal.section4.cancellation3.consequence1': 'The student is notified as soon as possible by email',
                'legal.section4.cancellation3.consequence2': 'The course is rescheduled to a mutually agreed date',
                'legal.section4.cancellation3.consequence3': 'The credit is kept for the new date',
                'legal.section4.cancellation3.consequence4': 'If rescheduling is impossible, a refund is made',
                'legal.section4.reschedule.title': '5. Course Rescheduling',
                'legal.section4.reschedule.intro': 'Rescheduling is possible up to 24 hours before the course, subject to teacher availability. To reschedule:',
                'legal.section4.reschedule.method1': 'Use the "Cancel" function in your dashboard',
                'legal.section4.reschedule.method2': 'A credit is automatically assigned to you',
                'legal.section4.reschedule.method3': 'Book a new time slot using your credit',
                'legal.section4.packages.title': '6. Course Packages',
                'legal.section4.packages.intro': 'For packages of 5 or 10 courses:',
                'legal.section4.packages.rule1': 'Credits are valid for 3 months from the purchase date',
                'legal.section4.packages.rule2': 'Late cancellations consume a credit',
                'legal.section4.packages.rule3': 'Unused credits expire without refund',
                'legal.section4.trial.title': '7. Trial Lesson',
                'legal.section4.trial.content': 'The €5 trial lesson follows the same cancellation rules. In case of late cancellation or absence, the amount is not refunded.',
                'legal.section4.refunds.title': '8. Refunds',
                'legal.section4.refunds.intro': 'Refunds are made according to the following terms:',
                'legal.section4.refunds.method1': 'Via the same payment method as the initial purchase',
                'legal.section4.refunds.method2': 'Within 14 business days maximum',
                'legal.section4.refunds.method3': 'Transaction fees may be deducted'
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
            console.log('🌍 Found desktop switcher:', desktopSwitcher);
            desktopSwitcher.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🌍 Clic sur le sélecteur de langue desktop');
                this.toggleLanguage();
            });
        }
        
        const mobileSwitcher = document.getElementById('languageSwitcherMobile');
        if (mobileSwitcher) {
            console.log('🌍 Found mobile switcher:', mobileSwitcher);
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
        console.log(`🌍 Applying translations in ${this.currentLanguage}`);
        
        // Compter les éléments
        const elements = document.querySelectorAll('[data-i18n]');
        console.log(`🌍 Found ${elements.length} elements with data-i18n`);
        
        elements.forEach((element, index) => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getTranslation(key);
            if (translation && translation !== key) {
                // Préserver les balises HTML si présentes
                if (translation.includes('<')) {
                    element.innerHTML = translation;
                } else {
                    element.textContent = translation;
                }
                if (index < 5) { // Afficher les 5 premiers pour debug
                    console.log(`🌍 Translated: ${key} -> ${translation.substring(0, 50)}...`);
                }
            } else if (!translation) {
                console.warn(`🌍 No translation for key: ${key}`);
            }
        });

        // Même chose pour les placeholders et titles
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
        const title = document.querySelector('title');
        if (title) {
            const pageKey = 'legal.title';
            const translation = this.getTranslation(pageKey);
            if (translation && translation !== pageKey) {
                title.textContent = translation;
            }
        }
        
        console.log('✅ Translations applied');
    }

    updateLanguageSwitchers() {
        const languageSwitchers = document.querySelectorAll(
            '.language-switcher span:last-child, ' +
            '.mobile-language span:last-child, ' +
            '.language-switcher-mobile span'
        );
        
        languageSwitchers.forEach(switcher => {
            // Mettre le texte à "FR" si la langue actuelle est "en", sinon "EN"
            switcher.textContent = this.currentLanguage === 'fr' ? 'EN' : 'FR';
            
            // Mettre à jour le titre (tooltip)
            const parent = switcher.closest('.language-switcher, .mobile-language, .language-switcher-mobile');
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