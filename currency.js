// currency.js - Gestionnaire de conversion de devises pour YoTeacher
// VERSION COMPLÈTE : 134 devises supportées

class CurrencyManager {
    constructor() {
        this.config = window.YOTEACHER_CONFIG || {};
        this.baseCurrency = 'EUR';
        this.currentCurrency = 'EUR';
        this.exchangeRates = {};
        this.isLoading = false;
        
        // Dropdown global listeners flag
        this._dropdownGlobalsReady = false;
        
        // ===== 134 DEVISES SUPPORTÉES =====
        this.supportedCurrencies = [
            'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD',
            'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BIF', 'BMD', 'BND',
            'BOB', 'BRL', 'BSD', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF',
            'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CVE', 'CZK', 'DJF',
            'DKK', 'DOP', 'DZD', 'EGP', 'ETB', 'EUR', 'FJD', 'FKP',
            'GBP', 'GEL', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD',
            'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JMD',
            'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KRW', 'KYD', 'KZT',
            'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'MAD', 'MDL', 'MGA',
            'MKD', 'MMK', 'MNT', 'MOP', 'MUR', 'MVR', 'MWK', 'MXN',
            'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD',
            'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR',
            'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SEK',
            'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'STD', 'SZL', 'THB',
            'TJS', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX',
            'USD', 'UYU', 'UZS', 'VND', 'VUV', 'WST', 'XAF', 'XCD',
            'XCG', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW'
        ];
        
        // ===== SYMBOLES DES DEVISES =====
        this.currencySymbols = {
            'AED': 'د.إ', 'AFN': '؋', 'ALL': 'L', 'AMD': '֏', 'ANG': 'ƒ',
            'AOA': 'Kz', 'ARS': '$', 'AUD': 'A$', 'AWG': 'ƒ', 'AZN': '₼',
            'BAM': 'KM', 'BBD': '$', 'BDT': '৳', 'BIF': 'Fr', 'BMD': '$',
            'BND': '$', 'BOB': 'Bs.', 'BRL': 'R$', 'BSD': '$', 'BWP': 'P',
            'BYN': 'Br', 'BZD': '$', 'CAD': 'CA$', 'CDF': 'Fr', 'CHF': 'CHF',
            'CLP': '$', 'CNY': '¥', 'COP': '$', 'CRC': '₡', 'CVE': '$',
            'CZK': 'Kč', 'DJF': 'Fdj', 'DKK': 'kr', 'DOP': 'RD$', 'DZD': 'د.ج',
            'EGP': '£', 'ETB': 'Br', 'EUR': '€', 'FJD': '$', 'FKP': '£',
            'GBP': '£', 'GEL': '₾', 'GIP': '£', 'GMD': 'D', 'GNF': 'Fr',
            'GTQ': 'Q', 'GYD': '$', 'HKD': 'HK$', 'HNL': 'L', 'HTG': 'G',
            'HUF': 'Ft', 'IDR': 'Rp', 'ILS': '₪', 'INR': '₹', 'ISK': 'kr',
            'JMD': '$', 'JPY': '¥', 'KES': 'Sh', 'KGS': 'с', 'KHR': '៛',
            'KMF': 'Fr', 'KRW': '₩', 'KYD': '$', 'KZT': '₸', 'LAK': '₭',
            'LBP': 'ل.ل', 'LKR': 'Rs', 'LRD': '$', 'LSL': 'L', 'MAD': 'د.م.',
            'MDL': 'L', 'MGA': 'Ar', 'MKD': 'ден', 'MMK': 'Ks', 'MNT': '₮',
            'MOP': 'P', 'MUR': '₨', 'MVR': '.ރ', 'MWK': 'MK', 'MXN': '$',
            'MYR': 'RM', 'MZN': 'MT', 'NAD': '$', 'NGN': '₦', 'NIO': 'C$',
            'NOK': 'kr', 'NPR': '₨', 'NZD': 'NZ$', 'PAB': 'B/.', 'PEN': 'S/',
            'PGK': 'K', 'PHP': '₱', 'PKR': '₨', 'PLN': 'zł', 'PYG': '₲',
            'QAR': 'ر.ق', 'RON': 'lei', 'RSD': 'дин.', 'RUB': '₽', 'RWF': 'Fr',
            'SAR': '﷼', 'SBD': '$', 'SCR': '₨', 'SEK': 'kr', 'SGD': 'S$',
            'SHP': '£', 'SLE': 'Le', 'SOS': 'Sh', 'SRD': '$', 'STD': 'Db',
            'SZL': 'L', 'THB': '฿', 'TJS': 'ЅМ', 'TOP': 'T$', 'TRY': '₺',
            'TTD': '$', 'TWD': 'NT$', 'TZS': 'Sh', 'UAH': '₴', 'UGX': 'Sh',
            'USD': '$', 'UYU': '$U', 'UZS': "so'm", 'VND': '₫', 'VUV': 'Vt',
            'WST': 'T', 'XAF': 'Fr', 'XCD': '$', 'XCG': '', 'XOF': 'Fr',
            'XPF': 'Fr', 'YER': '﷼', 'ZAR': 'R', 'ZMW': 'K'
        };
        
        // ===== POSITIONS DU SYMBOLE (true = avant, false = après) =====
        this.currencyPositions = {
            'AED': true, 'AFN': true, 'ALL': false, 'AMD': true, 'ANG': true,
            'AOA': true, 'ARS': true, 'AUD': true, 'AWG': true, 'AZN': true,
            'BAM': false, 'BBD': true, 'BDT': true, 'BIF': true, 'BMD': true,
            'BND': true, 'BOB': true, 'BRL': true, 'BSD': true, 'BWP': true,
            'BYN': true, 'BZD': true, 'CAD': true, 'CDF': true, 'CHF': true,
            'CLP': true, 'CNY': true, 'COP': true, 'CRC': true, 'CVE': true,
            'CZK': false, 'DJF': true, 'DKK': false, 'DOP': true, 'DZD': true,
            'EGP': true, 'ETB': true, 'EUR': true, 'FJD': true, 'FKP': true,
            'GBP': true, 'GEL': true, 'GIP': true, 'GMD': true, 'GNF': true,
            'GTQ': true, 'GYD': true, 'HKD': true, 'HNL': true, 'HTG': true,
            'HUF': false, 'IDR': true, 'ILS': true, 'INR': true, 'ISK': false,
            'JMD': true, 'JPY': true, 'KES': true, 'KGS': true, 'KHR': true,
            'KMF': true, 'KRW': true, 'KYD': true, 'KZT': true, 'LAK': true,
            'LBP': true, 'LKR': true, 'LRD': true, 'LSL': true, 'MAD': true,
            'MDL': false, 'MGA': true, 'MKD': false, 'MMK': true, 'MNT': true,
            'MOP': true, 'MUR': true, 'MVR': false, 'MWK': true, 'MXN': true,
            'MYR': true, 'MZN': true, 'NAD': true, 'NGN': true, 'NIO': true,
            'NOK': false, 'NPR': true, 'NZD': true, 'PAB': true, 'PEN': true,
            'PGK': true, 'PHP': true, 'PKR': true, 'PLN': false, 'PYG': true,
            'QAR': true, 'RON': false, 'RSD': false, 'RUB': false, 'RWF': true,
            'SAR': true, 'SBD': true, 'SCR': true, 'SEK': false, 'SGD': true,
            'SHP': true, 'SLE': true, 'SOS': true, 'SRD': true, 'STD': true,
            'SZL': true, 'THB': true, 'TJS': true, 'TOP': true, 'TRY': true,
            'TTD': true, 'TWD': true, 'TZS': true, 'UAH': true, 'UGX': true,
            'USD': true, 'UYU': true, 'UZS': false, 'VND': false, 'VUV': true,
            'WST': true, 'XAF': true, 'XCD': true, 'XCG': true, 'XOF': true,
            'XPF': true, 'YER': true, 'ZAR': true, 'ZMW': true
        };
        
        // ===== DEVISES SANS DÉCIMALES =====
        this.zeroDecimalCurrencies = [
            'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW',
            'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
        ];
        
        console.log('💱 CurrencyManager initialisé avec', this.supportedCurrencies.length, 'devises');
    }
    
    async init() {
        try {
            console.log('💱 Début de l\'initialisation de CurrencyManager');
            
            await this.loadExchangeRates();
            
            const profileLoaded = await this.loadCurrencyFromProfile();
            
            if (!profileLoaded) {
                const storedCurrency = localStorage.getItem('preferredCurrency');
                if (storedCurrency && this.supportedCurrencies.includes(storedCurrency)) {
                    this.currentCurrency = storedCurrency;
                    console.log(`💱 Devise restaurée depuis localStorage: ${this.currentCurrency}`);
                } else {
                    await this.detectUserCurrency();
                }
            }
            
            this._setupDropdownGlobals();
            this.initCurrencySelectors();
            
            console.log('✅ CurrencyManager prêt, émission d\'événement');
            window.dispatchEvent(new CustomEvent('currency:ready', {
                detail: { 
                    currency: this.currentCurrency,
                    rates: this.exchangeRates,
                    symbol: this.getSymbol()
                }
            }));
            
            window.dispatchEvent(new CustomEvent('currency:initialized'));
            
            return true;
        } catch (error) {
            console.error('❌ Erreur initialisation CurrencyManager:', error);
            
            this.exchangeRates = this.getStaticRates();
            this.exchangeRates['EUR'] = 1;
            this.currentCurrency = 'EUR';
            
            window.dispatchEvent(new CustomEvent('currency:ready', {
                detail: { 
                    currency: this.currentCurrency,
                    rates: this.exchangeRates,
                    symbol: this.getSymbol()
                }
            }));
            
            return true;
        }
    }
    
    // ===== SYNCHRONISATION SUPABASE =====
    async syncCurrencyToProfile(currencyCode) {
        if (!window.supabase || !window.authManager?.user?.id) {
            console.log('⚠️ Supabase/auth non disponible, sync profil ignorée');
            return false;
        }
        
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ preferred_currency: currencyCode })
                .eq('id', window.authManager.user.id);
                
            if (error) {
                const isConstraintError = error.code === '23514' 
                    || error.message?.toLowerCase().includes('check constraint');
                
                if (isConstraintError) {
                    console.warn(
                        `⚠️ CONTRAINTE DB : La devise "${currencyCode}" ` +
                        `n'est pas autorisée par profiles_preferred_currency_check. ` +
                        `La préférence reste en localStorage uniquement.`
                    );
                    
                    if (window.utils?.showNotification) {
                        window.utils.showNotification(
                            `La devise ${currencyCode} fonctionne localement, ` +
                            `mais n'est pas encore enregistrée sur votre profil.`,
                            'info'
                        );
                    }
                    return false;
                }
                throw error;
            }
            
            console.log('✅ Devise synchronisée dans le profil Supabase:', currencyCode);
            return true;
            
        } catch (error) {
            console.error('❌ Erreur sync devise vers profil:', error.message);
            return false;
        }
    }
    
    async loadCurrencyFromProfile() {
        if (!window.supabase || !window.authManager?.user?.id) {
            return false;
        }
        
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('preferred_currency')
                .eq('id', window.authManager.user.id)
                .maybeSingle();
                
            if (error) {
                console.warn('⚠️ Erreur chargement devise profil:', error.message);
                return false;
            }
            
            if (data?.preferred_currency && this.supportedCurrencies.includes(data.preferred_currency)) {
                this.currentCurrency = data.preferred_currency;
                localStorage.setItem('preferredCurrency', data.preferred_currency);
                console.log('💱 Devise chargée depuis profil Supabase:', data.preferred_currency);
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Exception chargement devise profil:', error);
        }
        return false;
    }
    
    async detectUserCurrency() {
        try {
            const userLocale = navigator.language || navigator.userLanguage;
            const countryCode = userLocale.split('-')[1] || userLocale.split('_')[1];
            
            if (countryCode) {
                const countryToCurrency = {
                    'US': 'USD', 'GB': 'GBP', 'CA': 'CAD', 'AU': 'AUD', 'JP': 'JPY',
                    'CN': 'CNY', 'SG': 'SGD', 'HK': 'HKD', 'NZ': 'NZD', 'SE': 'SEK',
                    'NO': 'NOK', 'DK': 'DKK', 'PL': 'PLN', 'MX': 'MXN', 'BR': 'BRL',
                    'IN': 'INR', 'RU': 'RUB', 'TR': 'TRY', 'ZA': 'ZAR', 'AE': 'AED',
                    'SA': 'SAR', 'TH': 'THB', 'KR': 'KRW', 'MY': 'MYR', 'CH': 'CHF',
                    'FR': 'EUR', 'DE': 'EUR', 'ES': 'EUR', 'IT': 'EUR', 'NL': 'EUR',
                    'BE': 'EUR', 'PT': 'EUR', 'IE': 'EUR', 'AT': 'EUR', 'FI': 'EUR',
                    'GR': 'EUR', 'LU': 'EUR', 'SK': 'EUR', 'SI': 'EUR', 'CY': 'EUR',
                    'MT': 'EUR', 'EE': 'EUR', 'LV': 'EUR', 'LT': 'EUR'
                };
                
                const detectedCurrency = countryToCurrency[countryCode.toUpperCase()];
                
                if (detectedCurrency && this.supportedCurrencies.includes(detectedCurrency)) {
                    this.currentCurrency = detectedCurrency;
                    console.log(`💱 Devise détectée: ${this.currentCurrency} (${countryCode})`);
                    return;
                }
            }
            
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            if (timezone.includes('America/New_York') || timezone.includes('America/Los_Angeles') || 
                timezone.includes('America/Chicago') || timezone.includes('America/Toronto')) {
                this.currentCurrency = 'USD';
            } else if (timezone.includes('Europe/London')) {
                this.currentCurrency = 'GBP';
            } else if (timezone.includes('Canada')) {
                this.currentCurrency = 'CAD';
            } else if (timezone.includes('Australia')) {
                this.currentCurrency = 'AUD';
            } else if (timezone.includes('Japan')) {
                this.currentCurrency = 'JPY';
            } else if (timezone.includes('Europe')) {
                this.currentCurrency = 'EUR';
            } else if (timezone.includes('Asia/Hong_Kong')) {
                this.currentCurrency = 'HKD';
            } else if (timezone.includes('Asia/Singapore')) {
                this.currentCurrency = 'SGD';
            }
            
            console.log(`💱 Devise détectée (fuseau): ${this.currentCurrency}`);
            
        } catch (error) {
            console.warn('⚠️ Erreur détection devise, utilisation EUR par défaut:', error);
            this.currentCurrency = 'EUR';
        }
    }
    
    async loadExchangeRates() {
        try {
            this.isLoading = true;
            console.log('💱 Début du chargement des taux de change');
            
            const cachedRates = localStorage.getItem('exchangeRates');
            if (cachedRates) {
                try {
                    const { rates, timestamp, expiresAt } = JSON.parse(cachedRates);
                    const now = Date.now();
                    
                    if (rates && expiresAt > now) {
                        this.exchangeRates = rates;
                        console.log('💾 Taux de change restaurés depuis le cache:', Object.keys(rates).length + ' devises');
                        this.isLoading = false;
                        return rates;
                    }
                } catch (cacheError) {
                    console.warn('⚠️ Erreur cache taux:', cacheError);
                }
            }
            
            const staticRates = this.getStaticRates();
            staticRates['EUR'] = 1;
            this.exchangeRates = staticRates;
            
            console.log('💰 Taux statiques chargés (fallback):', Object.keys(staticRates).length + ' devises');
            
            const apiSources = [
                'https://api.exchangerate-api.com/v4/latest/EUR',
                'https://open.er-api.com/v6/latest/EUR',
                'https://api.frankfurter.app/latest'
            ];
            
            const apiPromises = apiSources.map(apiUrl => 
                this.fetchExchangeRates(apiUrl).catch(error => {
                    console.log(`⚠️ API ${apiUrl} échouée:`, error.message);
                    return null;
                })
            );
            
            const results = await Promise.allSettled(apiPromises);
            
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value) {
                    this.exchangeRates = { ...staticRates, ...result.value };
                    this.exchangeRates['EUR'] = 1;
                    console.log(`✅ Taux API chargés:`, Object.keys(this.exchangeRates).length + ' devises');
                    break;
                }
            }
            
            if (!this.exchangeRates['USD']) {
                this.exchangeRates['USD'] = 1.17;
                console.warn('⚠️ USD manquant, valeur par défaut ajoutée');
            }
            
            if (!this.exchangeRates['EUR']) {
                this.exchangeRates['EUR'] = 1;
            }
            
            this.isLoading = false;
            
            localStorage.setItem('exchangeRates', JSON.stringify({
                rates: this.exchangeRates,
                timestamp: Date.now(),
                expiresAt: Date.now() + 3600000
            }));
            
            console.log('✅ Taux de change finalisés');
            
            window.dispatchEvent(new CustomEvent('exchangeRates:loaded', {
                detail: { rates: this.exchangeRates }
            }));
            
            return this.exchangeRates;
            
        } catch (error) {
            console.error('❌ Erreur critique chargement taux:', error);
            
            this.exchangeRates = this.getStaticRates();
            this.exchangeRates['EUR'] = 1;
            this.isLoading = false;
            
            return this.exchangeRates;
        }
    }
    
    async fetchExchangeRates(apiUrl) {
        return new Promise(async (resolve, reject) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            try {
                console.log(`🔗 Tentative API: ${apiUrl}`);
                const response = await fetch(apiUrl, { 
                    signal: controller.signal,
                    headers: { 'Accept': 'application/json' }
                });
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    reject(new Error(`HTTP ${response.status}`));
                    return;
                }
                
                const data = await response.json();
                
                let rates = {};
                if (data.rates) {
                    rates = data.rates;
                } else if (data.conversion_rates) {
                    rates = data.conversion_rates;
                }
                
                if (rates && rates['USD'] && rates['EUR']) {
                    resolve(rates);
                } else {
                    reject(new Error('Format de réponse invalide'));
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    reject(new Error('Timeout'));
                } else {
                    reject(fetchError);
                }
            }
        });
    }
    
    getStaticRates() {
        return {
            'AED': 4.30, 'AFN': 76.5, 'ALL': 101.5, 'AMD': 425.0, 'ANG': 2.11,
            'AOA': 910.0, 'ARS': 1180.0, 'AUD': 1.65, 'AWG': 1.99, 'AZN': 1.84,
            'BAM': 1.96, 'BBD': 2.24, 'BDT': 130.0, 'BIF': 3150.0, 'BMD': 1.17,
            'BND': 1.57, 'BOB': 8.10, 'BRL': 6.30, 'BSD': 1.17, 'BWP': 15.8,
            'BYN': 3.82, 'BZD': 2.36, 'CAD': 1.56, 'CDF': 3300.0, 'CHF': 0.94,
            'CLP': 1080.0, 'CNY': 7.85, 'COP': 4850.0, 'CRC': 600.0, 'CVE': 110.0,
            'CZK': 24.8, 'DJF': 209.0, 'DKK': 7.46, 'DOP': 70.0, 'DZD': 157.0,
            'EGP': 57.0, 'ETB': 145.0, 'EUR': 1.0, 'FJD': 2.62, 'FKP': 0.84,
            'GBP': 0.84, 'GEL': 3.25, 'GIP': 0.84, 'GMD': 82.0, 'GNF': 10100.0,
            'GTQ': 9.10, 'GYD': 245.0, 'HKD': 9.15, 'HNL': 29.0, 'HTG': 154.0,
            'HUF': 395.0, 'IDR': 19000.0, 'ILS': 4.35, 'INR': 99.0, 'ISK': 144.0,
            'JMD': 183.0, 'JPY': 169.0, 'KES': 151.0, 'KGS': 101.0, 'KHR': 4780.0,
            'KMF': 492.0, 'KRW': 1585.0, 'KYD': 0.98, 'KZT': 585.0, 'LAK': 25700.0,
            'LBP': 105000.0, 'LKR': 345.0, 'LRD': 225.0, 'LSL': 21.0, 'MAD': 11.4,
            'MDL': 20.8, 'MGA': 5200.0, 'MKD': 61.6, 'MMK': 2460.0, 'MNT': 4000.0,
            'MOP': 9.42, 'MUR': 54.0, 'MVR': 18.0, 'MWK': 2030.0, 'MXN': 21.5,
            'MYR': 5.20, 'MZN': 74.5, 'NAD': 21.0, 'NGN': 1820.0, 'NIO': 43.0,
            'NOK': 11.7, 'NPR': 158.0, 'NZD': 1.79, 'PAB': 1.17, 'PEN': 4.35,
            'PGK': 4.60, 'PHP': 67.0, 'PKR': 325.0, 'PLN': 4.24, 'PYG': 9000.0,
            'QAR': 4.26, 'RON': 4.98, 'RSD': 117.0, 'RUB': 105.0, 'RWF': 1580.0,
            'SAR': 4.39, 'SBD': 9.80, 'SCR': 16.8, 'SEK': 11.3, 'SGD': 1.58,
            'SHP': 0.84, 'SLE': 26.5, 'SOS': 670.0, 'SRD': 41.0, 'STD': 24000.0,
            'SZL': 21.0, 'THB': 38.5, 'TJS': 12.7, 'TOP': 2.76, 'TRY': 44.5,
            'TTD': 7.95, 'TWD': 37.5, 'TZS': 3050.0, 'UAH': 48.0, 'UGX': 4300.0,
            'USD': 1.17, 'UYU': 48.0, 'UZS': 14800.0, 'VND': 29500.0, 'VUV': 140.0,
            'WST': 3.25, 'XAF': 656.0, 'XCD': 3.16, 'XCG': 1.0, 'XOF': 656.0,
            'XPF': 119.0, 'YER': 293.0, 'ZAR': 21.0, 'ZMW': 31.5
        };
    }
    
    convert(amount, fromCurrency = 'EUR', toCurrency = null) {
        if (!toCurrency) {
            toCurrency = this.currentCurrency;
        }
        
        if (isNaN(amount) || amount === null || amount === undefined) {
            console.warn('❌ Montant invalide pour conversion:', amount);
            return 0;
        }
        
        amount = parseFloat(amount);
        
        if (fromCurrency === toCurrency) {
            return amount;
        }
        
        if (!this.exchangeRates || Object.keys(this.exchangeRates).length === 0) {
            console.warn('🚨 Taux vides, chargement d\'urgence...');
            this.exchangeRates = this.getStaticRates();
            this.exchangeRates['EUR'] = 1;
        }
        
        let fromRate = this.exchangeRates[fromCurrency];
        let toRate = this.exchangeRates[toCurrency];
        
        if (fromRate === undefined) {
            console.warn(`⚠️ Taux ${fromCurrency} manquant, utilisation 1`);
            fromRate = 1;
        }
        
        if (toRate === undefined) {
            console.warn(`⚠️ Taux ${toCurrency} manquant, utilisation 1`);
            toRate = 1;
        }
        
        const amountInEUR = fromCurrency === 'EUR' ? amount : amount / fromRate;
        const convertedAmount = amountInEUR * toRate;
        
        return parseFloat(convertedAmount.toFixed(2));
    }
    
    formatPrice(amount, currency = null, showSymbol = true) {
        if (!currency) {
            currency = this.currentCurrency;
        }
        
        const convertedAmount = this.convert(amount, 'EUR', currency);
        const symbol = this.currencySymbols[currency] || currency;
        const isSymbolBefore = this.currencyPositions[currency] !== false;
        
        let formattedPrice;
        
        if (this.zeroDecimalCurrencies.includes(currency)) {
            formattedPrice = Math.round(convertedAmount).toLocaleString();
        } else if (currency === 'INR') {
            formattedPrice = convertedAmount.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        } else {
            formattedPrice = convertedAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        
        if (!showSymbol) {
            return formattedPrice;
        }
        
        return isSymbolBefore ? `${symbol}${formattedPrice}` : `${formattedPrice} ${symbol}`;
    }
    
    formatPriceInCurrency(amount, currency, showSymbol = true) {
        const symbol = this.currencySymbols[currency] || currency;
        const isSymbolBefore = this.currencyPositions[currency] !== false;
        
        let formattedPrice;
        
        if (this.zeroDecimalCurrencies.includes(currency)) {
            formattedPrice = Math.round(amount).toLocaleString();
        } else if (currency === 'INR') {
            formattedPrice = amount.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        } else {
            formattedPrice = amount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
        
        if (!showSymbol) {
            return formattedPrice;
        }
        
        return isSymbolBefore ? `${symbol}${formattedPrice}` : `${formattedPrice} ${symbol}`;
    }
    
    setCurrency(currencyCode) {
        if (!this.supportedCurrencies.includes(currencyCode)) {
            console.warn(`❌ Devise non supportée: ${currencyCode}`);
            return false;
        }
        
        const previousCurrency = this.currentCurrency;
        this.currentCurrency = currencyCode;
        
        localStorage.setItem('preferredCurrency', currencyCode);
        
        this.syncCurrencyToProfile(currencyCode);
        
        console.log(`💱 Devise changée: ${previousCurrency} → ${currencyCode}`);
        
        this.updateCurrencySelectors();
        
        window.dispatchEvent(new CustomEvent('currency:changed', {
            detail: {
                from: previousCurrency,
                to: currencyCode,
                rates: this.exchangeRates
            }
        }));
        
        return true;
    }
    
    initCurrencySelectors() {
        console.log('💱 Initialisation des sélecteurs de devise');

        document.querySelectorAll('select[id^="currencySelector"]').forEach(selector => {
            this.initSingleSelector(selector);
        });

        const mobileSelector = document.getElementById('currencySelectorMobile');
        if (mobileSelector) {
            this.initSingleSelector(mobileSelector);
        }

        console.log('✅ Sélecteurs de devise initialisés');
    }

    /**
     * Initialize a single currency selector with a custom fixed dropdown.
     * The closed state looks identical to the native select.
     */
    initSingleSelector(selector) {
        if (!selector || selector.dataset.customReady === 'true') return;

        const parent = selector.parentNode;
        const wrapper = document.createElement('div');
        wrapper.className = 'currency-custom-dropdown';

        // Keep native select accessible to AT and forms, but visually hidden
        selector.classList.add('currency-native-select');

        // Trigger: closed state must match the original select appearance
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'currency-dropdown-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', 'Changer la devise');

        const sym = this.currencySymbols[this.currentCurrency] || this.currentCurrency;
        trigger.textContent = `${sym} ${this.currentCurrency}`;

        // Fixed-position panel
        const panel = document.createElement('div');
        panel.className = 'currency-dropdown-panel';
        panel.setAttribute('role', 'listbox');
        panel.setAttribute('aria-label', 'Devises disponibles');

        // Build ordered list: priority first, then separator, then others
        const priority = ['EUR', 'CAD', 'USD', 'GBP'];
        const others = this.supportedCurrencies.filter(c => !priority.includes(c));

        const buildItem = (code) => {
            const item = document.createElement('div');
            item.className = 'currency-dropdown-item';
            item.setAttribute('role', 'option');
            item.setAttribute('tabindex', '-1');
            item.setAttribute('data-value', code);
            item.setAttribute('aria-selected', code === this.currentCurrency ? 'true' : 'false');

            const uid = `cur-${code}-${Math.random().toString(36).slice(2, 8)}`;
            item.setAttribute('id', uid);

            const symbol = this.currencySymbols[code] || code;
            item.textContent = `${symbol} ${code}`;

            if (code === this.currentCurrency) {
                item.classList.add('active');
                trigger.setAttribute('aria-activedescendant', uid);
            }

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setCurrency(code);
                this._closeAllDropdowns();
            });

            return item;
        };

        priority.forEach(c => panel.appendChild(buildItem(c)));

        const divider = document.createElement('div');
        divider.className = 'currency-dropdown-separator';
        divider.setAttribute('role', 'separator');
        divider.setAttribute('aria-hidden', 'true');
        panel.appendChild(divider);

        others.forEach(c => panel.appendChild(buildItem(c)));

        wrapper.appendChild(trigger);
        wrapper.appendChild(panel);
        parent.insertBefore(wrapper, selector);
        wrapper.appendChild(selector);
        selector.dataset.customReady = 'true';

        // Open / close toggle
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = panel.classList.contains('open');
            this._closeAllDropdowns();
            if (!isOpen) {
                this._positionDropdown(trigger, panel);
                panel.classList.add('open');
                trigger.setAttribute('aria-expanded', 'true');
                const active = panel.querySelector('.active') || panel.querySelector('.currency-dropdown-item');
                if (active) active.focus();
            }
        });

        // Keyboard navigation
        trigger.addEventListener('keydown', (e) => this._handleDropdownKeys(e, panel, trigger));
        panel.addEventListener('keydown', (e) => this._handleDropdownKeys(e, panel, trigger));
    }

    /** Position dropdown with viewport boundary detection so it never opens off-screen. */
    _positionDropdown(trigger, panel) {
        const rect = trigger.getBoundingClientRect();
        const estHeight = Math.min(panel.scrollHeight || 300, 320);
        const estWidth = Math.max(rect.width, 150);

        let top = rect.bottom + 6;
        let left = rect.left;

        const vh = window.innerHeight;
        const vw = window.innerWidth;

        // Flip upward if overflowing bottom
        if (top + estHeight > vh - 12) {
            top = rect.top - estHeight - 6;
        }
        // Clamp right edge
        if (left + estWidth > vw - 12) {
            left = vw - estWidth - 12;
        }
        // Clamp left / top
        if (left < 12) left = 12;
        if (top < 12) top = 12;

        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
        panel.style.minWidth = `${rect.width}px`;
    }

    /** Close every open custom dropdown. */
    _closeAllDropdowns() {
        document.querySelectorAll('.currency-dropdown-panel.open').forEach(p => {
            p.classList.remove('open');
            const t = p.parentNode.querySelector('.currency-dropdown-trigger');
            if (t) {
                t.setAttribute('aria-expanded', 'false');
                t.removeAttribute('aria-activedescendant');
            }
        });
    }

    /** Full keyboard support: arrows, home/end, enter, space, escape, tab. */
    _handleDropdownKeys(e, panel, trigger) {
        const items = Array.from(panel.querySelectorAll('.currency-dropdown-item'));
        if (!items.length) return;

        let idx = items.findIndex(i => i === document.activeElement);
        if (idx === -1) idx = items.findIndex(i => i.classList.contains('active'));
        if (idx === -1) idx = 0;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                idx = (idx + 1) % items.length;
                items[idx].focus();
                break;
            case 'ArrowUp':
                e.preventDefault();
                idx = (idx - 1 + items.length) % items.length;
                items[idx].focus();
                break;
            case 'Home':
                e.preventDefault();
                items[0].focus();
                break;
            case 'End':
                e.preventDefault();
                items[items.length - 1].focus();
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (document.activeElement?.classList.contains('currency-dropdown-item')) {
                    document.activeElement.click();
                }
                break;
            case 'Escape':
                e.preventDefault();
                this._closeAllDropdowns();
                trigger.focus();
                break;
            case 'Tab':
                this._closeAllDropdowns();
                break;
        }
    }

    /**
     * Override: update native selects AND custom dropdown triggers
     * whenever the currency changes (programmatically or via click).
     */
    updateCurrencySelectors() {
        console.log('💱 Mise à jour des sélecteurs de devise');

        // Native selects (preserve original behavior)
        document.querySelectorAll('select[id*="currencySelector"]').forEach(sel => {
            if (sel.value !== this.currentCurrency) sel.value = this.currentCurrency;
        });

        // Update custom trigger text
        document.querySelectorAll('.currency-dropdown-trigger').forEach(t => {
            const sym = this.currencySymbols[this.currentCurrency] || this.currentCurrency;
            t.textContent = `${sym} ${this.currentCurrency}`;
        });

        // Update active highlight inside panels
        document.querySelectorAll('.currency-dropdown-item').forEach(item => {
            const isActive = item.dataset.value === this.currentCurrency;
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    /** One-time global listeners: outside click, resize, scroll. */
    _setupDropdownGlobals() {
        if (this._dropdownGlobalsReady) return;
        this._dropdownGlobalsReady = true;

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.currency-custom-dropdown')) {
                this._closeAllDropdowns();
            }
        });

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this._closeAllDropdowns(), 80);
        });

        window.addEventListener('scroll', () => this._closeAllDropdowns(), { passive: true });
    }

    getSymbol(currency = null) {
        if (!currency) {
            currency = this.currentCurrency;
        }
        return this.currencySymbols[currency] || currency;
    }
    
    isInteracCurrency() {
        return this.currentCurrency === 'CAD';
    }
    
    async forceCADForInterac() {
        if (this.currentCurrency !== 'CAD') {
            console.log(`💱 Interac détecté, passage de ${this.currentCurrency} à CAD`);
            
            const previousCurrency = this.currentCurrency;
            localStorage.setItem('previousCurrency', previousCurrency);
            
            const success = this.setCurrency('CAD');
            
            return success;
        }
        return true;
    }
    
    restorePreviousCurrency() {
        const previousCurrency = localStorage.getItem('previousCurrency');
        if (previousCurrency && this.supportedCurrencies.includes(previousCurrency)) {
            console.log(`💱 Restauration devise précédente: ${previousCurrency}`);
            this.setCurrency(previousCurrency);
            localStorage.removeItem('previousCurrency');
            return true;
        }
        return false;
    }
    
    convertVIPPrice(vipPriceData, targetCurrency = null) {
        if (!vipPriceData || vipPriceData.price === undefined) {
            console.warn('❌ Données VIP manquantes pour conversion');
            return null;
        }
        
        if (!targetCurrency) {
            targetCurrency = this.currentCurrency;
        }
        
        const originalPrice = parseFloat(vipPriceData.price);
        const originalCurrency = vipPriceData.currency || 'USD';
        
        if (originalCurrency === targetCurrency) {
            return {
                price: originalPrice,
                currency: targetCurrency,
                originalPrice: originalPrice,
                originalCurrency: originalCurrency,
                display: this.formatPriceInCurrency(originalPrice, targetCurrency),
                converted: false
            };
        }
        
        const fromRate = this.exchangeRates[originalCurrency];
        const toRate = this.exchangeRates[targetCurrency];
        
        if (!fromRate || !toRate) {
            console.warn(`⚠️ Taux non disponibles pour ${originalCurrency} → ${targetCurrency}`);
            
            const toEUR = this.exchangeRates[originalCurrency] || 1;
            const fromEUR = this.exchangeRates[targetCurrency] || 1;
            
            if (toEUR && fromEUR) {
                const amountInEUR = originalPrice / toEUR;
                const finalPrice = amountInEUR * fromEUR;
                
                return {
                    price: finalPrice,
                    currency: targetCurrency,
                    originalPrice: originalPrice,
                    originalCurrency: originalCurrency,
                    display: this.formatPriceInCurrency(finalPrice, targetCurrency),
                    converted: true
                };
            } else {
                return {
                    price: originalPrice,
                    currency: originalCurrency,
                    originalPrice: originalPrice,
                    originalCurrency: originalCurrency,
                    display: this.formatPriceInCurrency(originalPrice, originalCurrency),
                    converted: false
                };
            }
        }
        
        const amountInEUR = originalPrice / fromRate;
        const finalPrice = amountInEUR * toRate;
        
        return {
            price: finalPrice,
            currency: targetCurrency,
            originalPrice: originalPrice,
            originalCurrency: originalCurrency,
            display: this.formatPriceInCurrency(finalPrice, targetCurrency),
            converted: true
        };
    }
    
    formatVIPPrice(vipPriceData, showOriginal = false) {
        if (!vipPriceData || vipPriceData.price === undefined) return 'N/A';
        
        const converted = this.convertVIPPrice(vipPriceData);
        if (!converted) return 'N/A';
        
        if (showOriginal && converted.converted) {
            const originalDisplay = this.formatPriceInCurrency(
                vipPriceData.price, 
                vipPriceData.currency || 'USD'
            );
            return `${converted.display} (original: ${originalDisplay})`;
        }
        
        return converted.display;
    }
    
    formatWithSymbol(amount, currency = null) {
        if (!currency) {
            currency = this.currentCurrency;
        }
        
        const formatted = this.formatPriceInCurrency(amount, currency, false);
        const symbol = this.currencySymbols[currency] || currency;
        const isSymbolBefore = this.currencyPositions[currency] !== false;
        
        return isSymbolBefore ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
    }
    
    roundForCurrency(amount, currency = null) {
        if (!currency) {
            currency = this.currentCurrency;
        }
        
        if (this.zeroDecimalCurrencies.includes(currency)) {
            return Math.round(amount);
        }
        return Math.round(amount * 100) / 100;
    }
    
    getCurrencyInfo(currency = null) {
        if (!currency) {
            currency = this.currentCurrency;
        }
        
        return {
            code: currency,
            symbol: this.currencySymbols[currency] || currency,
            position: this.currencyPositions[currency] !== false ? 'before' : 'after',
            decimals: this.zeroDecimalCurrencies.includes(currency) ? 0 : 2,
            isSupported: this.supportedCurrencies.includes(currency),
            exchangeRate: this.exchangeRates[currency] || 1
        };
    }
}

// Initialiser et exposer globalement
window.currencyManager = new CurrencyManager();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🌍 DOM chargé, initialisation CurrencyManager');
        window.currencyManager.init().then(() => {
            console.log('✅ CurrencyManager initialisé avec succès');
        }).catch(error => {
            console.error('❌ Erreur initialisation CurrencyManager:', error);
        });
    });
} else {
    console.log('🌍 DOM déjà chargé, initialisation CurrencyManager');
    window.currencyManager.init().then(() => {
        console.log('✅ CurrencyManager initialisé avec succès');
    }).catch(error => {
        console.error('❌ Erreur initialisation CurrencyManager:', error);
    });
}

// Fonctions utilitaires globales
window.formatCurrency = (amount, currency = null) => {
    if (!window.currencyManager) {
        console.warn('⚠️ CurrencyManager non disponible pour formatCurrency');
        return `${amount}€`;
    }
    return window.currencyManager.formatPrice(amount, currency);
};

window.convertCurrency = (amount, from = 'EUR', to = null) => {
    if (!window.currencyManager) {
        console.warn('⚠️ CurrencyManager non disponible pour convertCurrency');
        return amount;
    }
    return window.currencyManager.convert(amount, from, to);
};

window.formatPriceInCurrency = (amount, currency, showSymbol = true) => {
    if (!window.currencyManager) {
        console.warn('⚠️ CurrencyManager non disponible pour formatPriceInCurrency');
        return `${amount} ${currency || 'EUR'}`;
    }
    return window.currencyManager.formatPriceInCurrency(amount, currency, showSymbol);
};

// Fonctions de debug
window.debugCurrency = () => {
    console.group('🚨 Debug CurrencyManager COMPLET');
    
    if (!window.currencyManager) {
        console.error('❌ currencyManager non disponible');
        console.groupEnd();
        return;
    }
    
    const cm = window.currencyManager;
    
    console.log('📊 Informations générales:');
    console.log('Devise actuelle:', cm.currentCurrency);
    console.log('Symbole:', cm.getSymbol());
    console.log('Taux chargés:', Object.keys(cm.exchangeRates || {}).length);
    console.log('Est en chargement:', cm.isLoading);
    console.log('Devises supportées:', cm.supportedCurrencies.length);
    console.log('Devises sans décimales:', cm.zeroDecimalCurrencies.length);
    
    console.log('\n💱 Taux de change clés:');
    const keyRates = ['EUR', 'USD', 'CAD', 'GBP', 'AUD', 'JPY', 'CHF'];
    keyRates.forEach(currency => {
        console.log(`${currency}:`, cm.exchangeRates[currency]);
    });
    
    console.log('\n🧪 Test de conversion:');
    console.log('10 EUR → USD:', cm.convert(10, 'EUR', 'USD'));
    console.log('10 EUR → JPY:', cm.convert(10, 'EUR', 'JPY'));
    console.log('10 EUR → VND:', cm.convert(10, 'EUR', 'VND'));
    
    console.log('\n💰 Test formatage (sans décimales):');
    console.log('Format 10000 JPY:', cm.formatPrice(10000, 'JPY'));
    console.log('Format 10000 VND:', cm.formatPrice(10000, 'VND'));
    
    console.log('\n💰 Test formatage (avec décimales):');
    console.log('Format 10 EUR:', cm.formatPrice(10));
    console.log('Format 10 USD:', cm.formatPrice(10, 'USD'));
    
    console.groupEnd();
};

window.debugVIPPriceIssue = function() {
    console.group('🔍 DEBUG PRIX VIP');
    
    if (window.currencyManager) {
        console.log('💱 CurrencyManager:');
        console.log('- Devise courante:', window.currencyManager.currentCurrency);
        console.log('- Symbole:', window.currencyManager.getSymbol());
        console.log('- Taux USD:', window.currencyManager.exchangeRates['USD']);
        console.log('- Taux EUR:', window.currencyManager.exchangeRates['EUR']);
    }
    
    if (window.authManager) {
        console.log('🔐 AuthManager:');
        console.log('- Utilisateur VIP:', window.authManager.isUserVip());
        console.log('- Utilisateur:', window.authManager.user?.email);
    }
    
    console.groupEnd();
};

// Export pour Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CurrencyManager };
}