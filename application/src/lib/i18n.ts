// App languages: French (default) and Arabic.
//
// - Texts live in the two dictionaries below. Arabic must have every French key:
//   TypeScript reports a missing one ("npm run typecheck").
// - In components:   const t = useT();   then   t('home.closingSoon')  or  t('card.limit', { date })
// - Outside components (format.ts, store.ts): import { t } and call it the same way.
// - The tender data itself (objet, acheteur, lieu…) comes from the portal in French and is not translated.
//
// Arabic is written right to left. Texts switch at once; the screen layout is mirrored
// on the next start of the app (React Native only applies the direction at start-up).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const fr = {
  // Navigation
  'tabs.home': 'Accueil',
  'tabs.consultations': 'Consultations',
  'tabs.attributions': 'Attributions',
  'tabs.favorites': 'Favoris',
  'screen.filters': 'Filtres',
  'screen.consultation': 'Consultation',
  'screen.document': 'Document',

  // Language
  'lang.title': 'Langue',
  'lang.restartTitle': 'Redémarrage nécessaire',
  'lang.restartMsg': "Fermez puis rouvrez l'application pour afficher l'écran de droite à gauche.",

  // Shared
  'common.ref': 'Réf. {ref}',
  'common.noObject': 'Sans objet',
  'common.pme': 'Réservé PME',
  'common.closed': 'Clôturée',
  'common.today': "Aujourd'hui",
  'common.daysLeft': 'J-{n}',
  'common.at': '{date} à {time}',
  'common.currency': 'MAD',
  'common.millions': 'M MAD',
  'common.thousands': 'k MAD',
  'common.oops': 'Oups',
  'common.retry': 'Réessayer',
  'common.cancel': 'Annuler',
  'common.delete': 'Supprimer',
  'common.serverError': 'Impossible de joindre le serveur. Vérifiez votre connexion.',
  'common.addFavorite': 'Ajouter aux favoris',
  'common.removeFavorite': 'Retirer des favoris',
  'common.share': 'Partager',
  'common.buyer': 'Acheteur public',

  // Categories (the values in the database stay in French)
  'cat.Travaux': 'Travaux',
  'cat.Fournitures': 'Fournitures',
  'cat.Services': 'Services',

  // Home
  'home.portal': 'Portail des marchés publics',
  'home.brand': 'Marchés Publics',
  'home.searchLabel': 'Rechercher une consultation',
  'home.searchPlaceholder': 'Objet, référence, acheteur…',
  'home.byCategory': 'Parcourir par catégorie',
  'home.openCount': '{n} en cours',
  'home.seeAll': 'Tout voir',
  'home.closingSoon': 'Clôturent bientôt',
  'home.nothingClosing': 'Rien ne clôture cette semaine',
  'home.shortcuts': 'Raccourcis',
  'home.sc.results': "Résultats d'attribution",
  'home.sc.resultsSub': 'Marchés attribués et PV',
  'home.sc.all': 'Toutes les consultations',
  'home.sc.allSub': 'Ouvertes et clôturées',
  'home.sc.pme': 'Réservés aux PME',
  'home.sc.pmeSub': 'Consultations ciblées',
  'home.sc.recent': 'Publiées récemment',
  'home.sc.recentSub': 'Les dernières annonces',
  'home.sc.favorites': 'Mes favoris',
  'home.sc.favoritesSub': 'Consultations suivies',

  // Consultations list
  'list.sort.dateLimite': 'Date limite ↑',
  'list.sort.recent': 'Plus récentes',
  'list.sort.estimation': 'Estimation ↓',
  'list.sortBy': 'Trier : {sort}',
  'list.search': 'Rechercher',
  'list.filtersActive': 'Filtres, {n} actifs',
  'list.total_one': '{n} consultation',
  'list.total': '{n} consultations',
  'list.save': 'Enregistrer',
  'list.savedTitle': 'Recherche enregistrée',
  'list.savedMsg': 'Retrouvez-la dans l’onglet Favoris.',
  'list.emptyTitle': 'Aucune consultation',
  'list.emptyMsg': 'Essayez d’autres mots-clés ou retirez des filtres.',
  'list.allConsultations': 'Toutes les consultations',

  // Status
  'statut.en_cours': 'En cours',
  'statut.cloturee': 'Clôturées',
  'statut.toutes': 'Toutes',

  // Filters
  'filters.reset': 'Effacer',
  'filters.statut': 'Statut',
  'filters.category': 'Catégorie',
  'filters.procedure': 'Procédure',
  'filters.region': 'Région',
  'filters.all': 'Toutes',
  'filters.buyerPlaceholder': 'Ministère, commune, établissement…',
  'filters.deadline': 'Date limite de remise des plis',
  'filters.next7': '7 prochains jours',
  'filters.next30': '30 prochains jours',
  'filters.estimation': 'Estimation (MAD TTC)',
  'filters.min': 'Min',
  'filters.max': 'Max',
  'filters.estMin': 'Estimation minimum',
  'filters.estMax': 'Estimation maximum',
  'filters.pme': 'Réservé aux PME',
  'filters.pmeHelp': 'PME, coopératives, auto-entrepreneurs',
  'filters.apply': 'Afficher les résultats',

  // Card
  'card.estimation': 'Estimation',
  'card.caution': 'Caution',
  'card.limit': 'Limite : {date}',

  // Detail
  'detail.download_one': 'Télécharger le dossier ({n} fichier)',
  'detail.download': 'Télécharger le dossier ({n} fichiers)',
  'detail.portal': 'Voir sur le portail',
  'detail.deadline': 'DATE LIMITE DE REMISE DES PLIS',
  'detail.days_one': 'jour',
  'detail.days': 'jours',
  'detail.keyFacts': 'Informations clés',
  'detail.place': "Lieu d'exécution",
  'detail.procedure': 'Procédure',
  'detail.estimation': 'Estimation',
  'detail.caution': 'Caution provisoire',
  'detail.publication': 'Publication',
  'detail.opening': 'Ouverture des plis',
  'detail.visit': 'Visite des lieux',
  'detail.reference': 'Référence',
  'detail.documents': 'Dossier de consultation',
  'detail.document': 'Document',
  'detail.calendar': 'Calendrier',
  'detail.submission': 'Remise des plis',
  'detail.shareDeadline': 'Date limite : {date}',

  // Attributions
  'attr.all': 'Tous',
  'attr.won': 'Attribués',
  'attr.failed': 'Infructueux',
  'attr.wonOne': 'Attribué',
  'attr.failedOne': 'Infructueux',
  'attr.empty': 'Aucun résultat pour le moment',
  'attr.soon': 'Bientôt disponible',
  'attr.soonMsg': 'Les résultats d’attribution ne sont pas encore collectés dans la base de données.',
  'attr.winner': 'ATTRIBUTAIRE',
  'attr.amount': 'MONTANT',
  'attr.pv': 'Extrait du PV',
  'attr.offers_one': '{n} offre reçue',
  'attr.offers': '{n} offres reçues',

  // Favourites
  'fav.savedSearches': 'Recherches enregistrées',
  'fav.savedHint': 'Dans Consultations, réglez vos filtres puis touchez « Enregistrer » pour retrouver la recherche ici.',
  'fav.deleteSearch': 'Supprimer la recherche ?',
  'fav.followed': 'Consultations suivies',
  'fav.emptyTitle': 'Aucun favori',
  'fav.emptyMsg': 'Touchez l’icône signet sur une consultation pour la suivre ici.',

  // PDF reader
  'pdf.loading': 'Ouverture du document…',
  'pdf.errorTitle': "Le document n'a pas pu être affiché",
  'pdf.errorMsg': "Vérifiez votre connexion, ou téléchargez le fichier pour l'ouvrir avec une autre application.",
  'pdf.retry': 'Réessayer',
  'pdf.download': 'Télécharger',
  'doc.readInApp': "Lire dans l'application",
  'doc.readHint': "Ouvre le document dans l'application",
  'doc.downloadLabel': 'Télécharger {name}',
  // Account, login and Premium
  'screen.login': 'Connexion',
  'screen.register': 'Créer un compte',
  'screen.forgot': 'Mot de passe oublié',
  'screen.premium': 'Premium',
  'screen.account': 'Mon compte',
  'auth.loginTitle': 'Connexion',
  'auth.loginSubtitle': 'Connectez-vous pour accéder à votre abonnement Premium. La consultation des marchés reste gratuite, sans compte.',
  'auth.continueFree': 'Continuer gratuitement',
  'auth.email': 'Adresse e-mail',
  'auth.emailPlaceholder': 'nom@entreprise.ma',
  'auth.password': 'Mot de passe',
  'auth.passwordPlaceholder': 'Votre mot de passe',
  'auth.showPassword': 'Afficher le mot de passe',
  'auth.hidePassword': 'Masquer le mot de passe',
  'auth.forgot': 'Mot de passe oublié ?',
  'auth.submitLogin': 'Se connecter',
  'auth.noAccount': 'Pas encore Premium ?',
  'auth.createAccount': 'Créer un compte',
  'auth.registerTitle': 'Créer un compte',
  'auth.registerSubtitle': 'Le compte sert à activer Premium. La consultation des marchés reste gratuite.',
  'auth.name': 'Nom complet',
  'auth.namePlaceholder': 'Prénom Nom',
  'auth.company': 'Entreprise',
  'auth.optional': '(facultatif)',
  'auth.companyPlaceholder': 'Raison sociale',
  'auth.newPasswordPlaceholder': 'Au moins 8 caractères',
  'auth.passwordRule': '8 caractères minimum, dont au moins un chiffre',
  'auth.terms': "J'accepte les conditions d'utilisation et la politique de confidentialité.",
  'auth.submitRegister': 'Créer mon compte',
  'auth.haveAccount': 'Déjà inscrit ?',
  'auth.forgotTitle': 'Mot de passe oublié',
  'auth.forgotSubtitle': "Saisissez l'e-mail de votre compte. WhatsApp s'ouvre avec un message prêt : nous vous répondrons avec un mot de passe temporaire.",
  'auth.forgotSubmit': 'Demander sur WhatsApp',
  'auth.forgotSentTitle': 'Envoyez le message',
  'auth.forgotSentMsg': 'Touchez « Envoyer » dans WhatsApp. Nous vous répondrons avec un mot de passe temporaire pour vous connecter.',
  'auth.backToLogin': 'Retour à la connexion',
  'err.invalidEmail': 'Adresse e-mail invalide.',
  'err.weakPassword': 'Le mot de passe doit contenir au moins 8 caractères, dont un chiffre.',
  'err.missingName': 'Indiquez votre nom.',
  'err.emailTaken': 'Un compte existe déjà avec cette adresse. Connectez-vous.',
  'err.badCredentials': 'E-mail ou mot de passe incorrect.',
  'err.tooMany': 'Trop de tentatives. Réessayez dans quelques minutes.',
  'err.terms': 'Acceptez les conditions pour continuer.',
  'err.whatsapp': "Impossible d'ouvrir WhatsApp. Écrivez-nous au 07 66 10 70 47.",
  'err.generic': 'Une erreur est survenue. Réessayez.',
  'premium.badge': 'PREMIUM',
  'premium.title': 'Passez à Premium',
  'premium.subtitle': 'La consultation reste gratuite. Premium débloque les outils pour ne rater aucun marché.',
  'premium.perk1': 'Alertes sur les nouvelles consultations selon vos critères',
  'premium.perk2': 'Favoris et recherches synchronisés sur tous vos appareils',
  'premium.perk3': 'Rappels avant la date limite de remise des plis',
  'premium.priceNote': 'Le tarif et le paiement vous sont communiqués sur WhatsApp.',
  'premium.howTitle': 'Comment ça marche',
  'premium.step1': "1. Envoyez la demande : WhatsApp s'ouvre avec un message prêt, contenant votre e-mail.",
  'premium.step2': '2. Nous vous répondons pour le paiement.',
  'premium.step3': "3. Premium s'active sur votre compte, sans réinstaller l'application.",
  'premium.request': "Demander l'activation sur WhatsApp",
  'premium.signedInAs': 'Connecté en tant que {email}',
  'premium.pendingTitle': 'Demande en attente',
  'premium.pendingMsg': "Envoyez le message dans WhatsApp si ce n'est pas encore fait. Dès que le paiement est confirmé, Premium s'active ici automatiquement.",
  'premium.resend': 'Renvoyer le message',
  'premium.checkStatus': 'Vérifier mon statut',
  'premium.activeTitle': 'Premium est actif',
  'premium.activeUntil': "Valable jusqu'au {date}",
  'premium.activeNoEnd': 'Sans date de fin',
  'premium.thanks': 'Merci ! Toutes les fonctionnalités Premium sont débloquées.',
  'premium.loginFirst': 'Connectez-vous ou créez un compte pour activer Premium.',
  'account.guestTitle': 'Abonnement Premium',
  'account.guestMsg': 'Vous utilisez la version gratuite, sans compte. Connectez-vous pour passer à Premium.',
  'account.login': 'Se connecter',
  'account.planFree': 'Gratuit',
  'account.planPremium': 'Premium',
  'account.planPending': 'Premium demandé',
  'account.upgrade': 'Passer à Premium',
  'account.open': 'Ouvrir mon compte',
  'account.plan': 'Formule',
  'account.logout': 'Se déconnecter',
  'account.logoutConfirm': 'Se déconnecter ?',
  'account.delete': 'Supprimer mon compte',
  'account.deleteMsg': 'Votre compte et votre abonnement seront supprimés définitivement. Saisissez votre mot de passe pour confirmer.',
  'account.deleteConfirm': 'Supprimer définitivement',
  'home.premiumSub': 'Alertes, rappels de date limite et favoris sur tous vos appareils.',
  'home.premiumPendingSub': 'Votre demande est en cours de validation.',
  'home.premiumCta': 'Découvrir',
  'home.premiumFollow': 'Suivre',
};

export type TKey = keyof typeof fr;

const ar: Record<TKey, string> = {
  'tabs.home': 'الرئيسية',
  'tabs.consultations': 'طلبات العروض',
  'tabs.attributions': 'النتائج',
  'tabs.favorites': 'المفضلة',
  'screen.filters': 'التصفية',
  'screen.consultation': 'طلب العروض',
  'screen.document': 'وثيقة',

  'lang.title': 'اللغة',
  'lang.restartTitle': 'إعادة التشغيل مطلوبة',
  'lang.restartMsg': 'أغلق التطبيق ثم أعد فتحه لعرض الشاشة من اليمين إلى اليسار.',

  'common.ref': 'المرجع {ref}',
  'common.noObject': 'بدون موضوع',
  'common.pme': 'مخصص للمقاولات الصغرى والمتوسطة',
  'common.closed': 'منتهية',
  'common.today': 'اليوم',
  'common.daysLeft': '{n} أيام',
  'common.at': '{date} على الساعة {time}',
  'common.currency': 'درهم',
  'common.millions': 'مليون درهم',
  'common.thousands': 'ألف درهم',
  'common.oops': 'عذرًا',
  'common.retry': 'إعادة المحاولة',
  'common.cancel': 'إلغاء',
  'common.delete': 'حذف',
  'common.serverError': 'تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.',
  'common.addFavorite': 'إضافة إلى المفضلة',
  'common.removeFavorite': 'إزالة من المفضلة',
  'common.share': 'مشاركة',
  'common.buyer': 'صاحب المشروع',

  'cat.Travaux': 'أشغال',
  'cat.Fournitures': 'توريدات',
  'cat.Services': 'خدمات',

  'home.portal': 'بوابة الصفقات العمومية',
  'home.brand': 'الصفقات العمومية',
  'home.searchLabel': 'البحث عن طلب عروض',
  'home.searchPlaceholder': 'الموضوع، المرجع، صاحب المشروع…',
  'home.byCategory': 'تصفح حسب الفئة',
  'home.openCount': '{n} جارية',
  'home.seeAll': 'عرض الكل',
  'home.closingSoon': 'تنتهي قريبًا',
  'home.nothingClosing': 'لا شيء ينتهي هذا الأسبوع',
  'home.shortcuts': 'اختصارات',
  'home.sc.results': 'نتائج الإسناد',
  'home.sc.resultsSub': 'الصفقات المسندة والمحاضر',
  'home.sc.all': 'جميع طلبات العروض',
  'home.sc.allSub': 'المفتوحة والمنتهية',
  'home.sc.pme': 'مخصصة للمقاولات الصغرى والمتوسطة',
  'home.sc.pmeSub': 'طلبات عروض موجهة',
  'home.sc.recent': 'المنشورة حديثًا',
  'home.sc.recentSub': 'آخر الإعلانات',
  'home.sc.favorites': 'مفضلتي',
  'home.sc.favoritesSub': 'طلبات العروض المتابَعة',

  'list.sort.dateLimite': 'آخر أجل ↑',
  'list.sort.recent': 'الأحدث',
  'list.sort.estimation': 'التقدير ↓',
  'list.sortBy': 'ترتيب: {sort}',
  'list.search': 'بحث',
  'list.filtersActive': 'التصفية، {n} مفعّلة',
  'list.total_one': 'طلب عروض واحد',
  'list.total': '{n} طلب عروض',
  'list.save': 'حفظ',
  'list.savedTitle': 'تم حفظ البحث',
  'list.savedMsg': 'تجده في تبويب المفضلة.',
  'list.emptyTitle': 'لا توجد طلبات عروض',
  'list.emptyMsg': 'جرّب كلمات أخرى أو أزِل بعض عوامل التصفية.',
  'list.allConsultations': 'جميع طلبات العروض',

  'statut.en_cours': 'جارية',
  'statut.cloturee': 'منتهية',
  'statut.toutes': 'الكل',

  'filters.reset': 'مسح',
  'filters.statut': 'الحالة',
  'filters.category': 'الفئة',
  'filters.procedure': 'المسطرة',
  'filters.region': 'الجهة',
  'filters.all': 'الكل',
  'filters.buyerPlaceholder': 'وزارة، جماعة، مؤسسة…',
  'filters.deadline': 'آخر أجل لإيداع الأظرفة',
  'filters.next7': 'الأيام السبعة القادمة',
  'filters.next30': 'الثلاثون يومًا القادمة',
  'filters.estimation': 'التقدير (درهم، مع احتساب الرسوم)',
  'filters.min': 'الأدنى',
  'filters.max': 'الأقصى',
  'filters.estMin': 'التقدير الأدنى',
  'filters.estMax': 'التقدير الأقصى',
  'filters.pme': 'مخصص للمقاولات الصغرى والمتوسطة',
  'filters.pmeHelp': 'المقاولات الصغرى والمتوسطة، التعاونيات، المقاولون الذاتيون',
  'filters.apply': 'عرض النتائج',

  'card.estimation': 'التقدير',
  'card.caution': 'الضمان',
  'card.limit': 'الأجل: {date}',

  'detail.download_one': 'تحميل الملف (وثيقة واحدة)',
  'detail.download': 'تحميل الملف ({n} وثائق)',
  'detail.portal': 'عرض في البوابة',
  'detail.deadline': 'آخر أجل لإيداع الأظرفة',
  'detail.days_one': 'يوم',
  'detail.days': 'أيام',
  'detail.keyFacts': 'معلومات أساسية',
  'detail.place': 'مكان التنفيذ',
  'detail.procedure': 'المسطرة',
  'detail.estimation': 'التقدير',
  'detail.caution': 'الضمان المؤقت',
  'detail.publication': 'النشر',
  'detail.opening': 'فتح الأظرفة',
  'detail.visit': 'زيارة الموقع',
  'detail.reference': 'المرجع',
  'detail.documents': 'ملف طلب العروض',
  'detail.document': 'وثيقة',
  'detail.calendar': 'الجدول الزمني',
  'detail.submission': 'إيداع الأظرفة',
  'detail.shareDeadline': 'آخر أجل: {date}',

  'attr.all': 'الكل',
  'attr.won': 'المسندة',
  'attr.failed': 'غير المثمرة',
  'attr.wonOne': 'مسندة',
  'attr.failedOne': 'غير مثمرة',
  'attr.empty': 'لا توجد نتائج حاليًا',
  'attr.soon': 'قريبًا',
  'attr.soonMsg': 'نتائج الإسناد غير متوفرة بعد في قاعدة البيانات.',
  'attr.winner': 'نائل الصفقة',
  'attr.amount': 'المبلغ',
  'attr.pv': 'مستخرج المحضر',
  'attr.offers_one': 'عرض واحد متوصَّل به',
  'attr.offers': '{n} عروض متوصَّل بها',

  'fav.savedSearches': 'عمليات البحث المحفوظة',
  'fav.savedHint': 'في تبويب طلبات العروض، اضبط عوامل التصفية ثم اضغط «حفظ» لتجد البحث هنا.',
  'fav.deleteSearch': 'حذف هذا البحث؟',
  'fav.followed': 'طلبات العروض المتابَعة',
  'fav.emptyTitle': 'لا توجد مفضلات',
  'fav.emptyMsg': 'اضغط على أيقونة الإشارة في طلب عروض لمتابعته هنا.',

  'pdf.loading': 'جارٍ فتح الوثيقة…',
  'pdf.errorTitle': 'تعذّر عرض الوثيقة',
  'pdf.errorMsg': 'تحقّق من اتصالك، أو حمّل الملف لفتحه بتطبيق آخر.',
  'pdf.retry': 'إعادة المحاولة',
  'pdf.download': 'تحميل',
  'doc.readInApp': 'القراءة داخل التطبيق',
  'doc.readHint': 'يفتح الوثيقة داخل التطبيق',
  'doc.downloadLabel': 'تحميل {name}',
  // Account, login and Premium
  'screen.login': 'تسجيل الدخول',
  'screen.register': 'إنشاء حساب',
  'screen.forgot': 'نسيت كلمة المرور',
  'screen.premium': 'بريميوم',
  'screen.account': 'حسابي',
  'auth.loginTitle': 'تسجيل الدخول',
  'auth.loginSubtitle': 'سجّل الدخول للوصول إلى اشتراك بريميوم. تصفح الصفقات يبقى مجانياً وبدون حساب.',
  'auth.continueFree': 'المتابعة مجاناً',
  'auth.email': 'البريد الإلكتروني',
  'auth.emailPlaceholder': 'nom@entreprise.ma',
  'auth.password': 'كلمة المرور',
  'auth.passwordPlaceholder': 'كلمة المرور',
  'auth.showPassword': 'إظهار كلمة المرور',
  'auth.hidePassword': 'إخفاء كلمة المرور',
  'auth.forgot': 'نسيت كلمة المرور؟',
  'auth.submitLogin': 'تسجيل الدخول',
  'auth.noAccount': 'لست مشتركاً في بريميوم بعد؟',
  'auth.createAccount': 'إنشاء حساب',
  'auth.registerTitle': 'إنشاء حساب',
  'auth.registerSubtitle': 'الحساب مخصص لتفعيل بريميوم. تصفح الصفقات يبقى مجانياً.',
  'auth.name': 'الاسم الكامل',
  'auth.namePlaceholder': 'الاسم العائلي والشخصي',
  'auth.company': 'المقاولة',
  'auth.optional': '(اختياري)',
  'auth.companyPlaceholder': 'الاسم التجاري',
  'auth.newPasswordPlaceholder': '8 أحرف على الأقل',
  'auth.passwordRule': '8 أحرف على الأقل، منها رقم واحد على الأقل',
  'auth.terms': 'أوافق على شروط الاستخدام وسياسة الخصوصية.',
  'auth.submitRegister': 'إنشاء حسابي',
  'auth.haveAccount': 'لديك حساب؟',
  'auth.forgotTitle': 'نسيت كلمة المرور',
  'auth.forgotSubtitle': 'أدخل البريد الإلكتروني لحسابك. سيفتح واتساب برسالة جاهزة، وسنرد عليك بكلمة مرور مؤقتة.',
  'auth.forgotSubmit': 'الطلب عبر واتساب',
  'auth.forgotSentTitle': 'أرسل الرسالة',
  'auth.forgotSentMsg': 'اضغط على «إرسال» في واتساب. سنرد عليك بكلمة مرور مؤقتة لتسجيل الدخول.',
  'auth.backToLogin': 'العودة إلى تسجيل الدخول',
  'err.invalidEmail': 'البريد الإلكتروني غير صالح.',
  'err.weakPassword': 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل، منها رقم.',
  'err.missingName': 'أدخل اسمك.',
  'err.emailTaken': 'يوجد حساب بهذا البريد الإلكتروني. سجّل الدخول.',
  'err.badCredentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  'err.tooMany': 'محاولات كثيرة. أعد المحاولة بعد بضع دقائق.',
  'err.terms': 'وافق على الشروط للمتابعة.',
  'err.whatsapp': 'تعذر فتح واتساب. راسلنا على الرقم 07 66 10 70 47.',
  'err.generic': 'حدث خطأ. أعد المحاولة.',
  'premium.badge': 'بريميوم',
  'premium.title': 'انتقل إلى بريميوم',
  'premium.subtitle': 'التصفح يبقى مجانياً. بريميوم يمنحك الأدوات حتى لا تفوتك أي صفقة.',
  'premium.perk1': 'تنبيهات بطلبات العروض الجديدة حسب معاييرك',
  'premium.perk2': 'مفضلات وعمليات بحث متزامنة على جميع أجهزتك',
  'premium.perk3': 'تذكير قبل آخر أجل لإيداع الأظرفة',
  'premium.priceNote': 'سنبلغك بالسعر وطريقة الأداء عبر واتساب.',
  'premium.howTitle': 'كيف يعمل',
  'premium.step1': '1. أرسل الطلب: يفتح واتساب برسالة جاهزة تتضمن بريدك الإلكتروني.',
  'premium.step2': '2. نرد عليك بخصوص الأداء.',
  'premium.step3': '3. يتم تفعيل بريميوم على حسابك دون إعادة تثبيت التطبيق.',
  'premium.request': 'طلب التفعيل عبر واتساب',
  'premium.signedInAs': 'متصل باسم {email}',
  'premium.pendingTitle': 'الطلب قيد الانتظار',
  'premium.pendingMsg': 'أرسل الرسالة في واتساب إن لم تفعل بعد. بمجرد تأكيد الأداء، يتفعّل بريميوم هنا تلقائياً.',
  'premium.resend': 'إعادة إرسال الرسالة',
  'premium.checkStatus': 'التحقق من حالتي',
  'premium.activeTitle': 'بريميوم مفعّل',
  'premium.activeUntil': 'صالح إلى غاية {date}',
  'premium.activeNoEnd': 'بدون تاريخ انتهاء',
  'premium.thanks': 'شكراً! جميع ميزات بريميوم متاحة الآن.',
  'premium.loginFirst': 'سجّل الدخول أو أنشئ حساباً لتفعيل بريميوم.',
  'account.guestTitle': 'اشتراك بريميوم',
  'account.guestMsg': 'أنت تستخدم النسخة المجانية بدون حساب. سجّل الدخول للانتقال إلى بريميوم.',
  'account.login': 'تسجيل الدخول',
  'account.planFree': 'مجاني',
  'account.planPremium': 'بريميوم',
  'account.planPending': 'تم طلب بريميوم',
  'account.upgrade': 'الانتقال إلى بريميوم',
  'account.open': 'فتح حسابي',
  'account.plan': 'الاشتراك',
  'account.logout': 'تسجيل الخروج',
  'account.logoutConfirm': 'تسجيل الخروج؟',
  'account.delete': 'حذف حسابي',
  'account.deleteMsg': 'سيتم حذف حسابك واشتراكك نهائياً. أدخل كلمة المرور للتأكيد.',
  'account.deleteConfirm': 'حذف نهائي',
  'home.premiumSub': 'تنبيهات، تذكير بآخر أجل، ومفضلات على جميع أجهزتك.',
  'home.premiumPendingSub': 'طلبك قيد المراجعة.',
  'home.premiumCta': 'اكتشف',
  'home.premiumFollow': 'متابعة',
};

export type Lang = 'fr' | 'ar';
const dictionaries: Record<Lang, Record<string, string>> = { fr, ar };

/** Language chosen by the user, saved on the phone. */
export const useLang = create<{ lang: Lang; setLang: (lang: Lang) => void }>()(
  persist(
    (set) => ({
      lang: 'fr',
      setLang: (lang) => set({ lang }), // LanguageSwitch also calls applyDirection()
    }),
    {
      name: 'marches-lang',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => applyDirection(state?.lang ?? 'fr'),
    },
  ),
);

/** Right-to-left for Arabic. Returns true when the app must restart for the layout to flip. */
export function applyDirection(lang: Lang): boolean {
  const rtl = lang === 'ar';
  if (Platform.OS === 'web') {
    // The browser flips the layout at once.
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    return false;
  }
  if (I18nManager.isRTL === rtl) return false;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl); // applied the next time the app starts
  return true;
}

/** Translate a key. {name} placeholders are filled from params; "count" picks the _one form for 1. */
export function t(key: TKey, params?: Record<string, string | number>): string {
  const dict = dictionaries[useLang.getState().lang];
  const count = params?.count ?? params?.n;
  const one = count === 1 ? dict[`${key}_one`] : undefined;
  let text = one ?? dict[key] ?? fr[key] ?? key;
  for (const [k, v] of Object.entries(params ?? {})) text = text.split(`{${k}}`).join(String(v));
  return text;
}

/** Same as t(), and makes the component re-render when the language changes. */
export function useT() {
  useLang((s) => s.lang);
  return t;
}

/** Category label in the current language ("Travaux" -> "أشغال"). Unknown values are shown as they are. */
export function categoryLabel(c: string | null | undefined): string {
  if (!c) return '';
  const key = `cat.${c}` as TKey;
  return key in fr ? t(key) : c;
}

/**
 * Absolute position on the "end" side (right in French, left in Arabic).
 * Phones mirror { end } themselves; the web version needs left/right spelled out.
 */
export function endOffset(n: number) {
  if (Platform.OS !== 'web') return { end: n };
  return useLang.getState().lang === 'ar' ? { left: n } : { right: n };
}

export const locale = () => (useLang.getState().lang === 'ar' ? 'ar-MA' : 'fr-MA');
