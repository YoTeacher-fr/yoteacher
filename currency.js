// currency.js - Gestionnaire de conversion de devises pour YoTeacher - VERSION COMPLÈTE

class CurrencyManager {
    constructor() {
        this.config = window.YOTEACHER_CONFIG || {};
        this.baseCurrency = 'EUR'; // Devise de base des prix
        this.currentCurrency = 'EUR';
        this.exchangeRates = {};
        this.isLoading = false;
        
        // Devises supportées par Stripe (majeures)
        this.supportedCurrencies = [
            'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'CNY', 'SGD',
            'HKD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'MXN', 'BRL', 'INR',
            'RUB', 'TRY', 'ZAR', 'AED', 'SAR', 'THB', 'KRW', 'MYR'
        ];
        
        // Symboles des devises
        this.currencySymbols = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'CAD': 'CA$', 'AUD': 'A$',
            'CHF': 'CHF', 'JPY': '¥', 'CNY': '¥', 'SGD': 'S$', 'HKD': 'HK$',
            'NZD': 'NZ$', 'SEK': 'kr', 'NOK': 'kr', 'DKK': 'kr', 'PLN': 'zł',
            'MXN': '$', 'BRL': 'R$', 'INR': '₹', 'RUB': '₽', 'TRY': '₺',
            'ZAR': 'R', 'AED': 'د.إ', 'SAR': '﷼', 'THB': '฿', 'KRW': '₩', 'MYR': 'RM'
        };
        
        // Positions du symbole (true = avant, false = après)
        this.currencyPositions = {
            'USD': true, 'EUR': true, 'GBP': true, 'CAD': true, 'AUD': true,
            'CHF': true, 'JPY': true, 'CNY': true, 'SGD': true, 'HKD': true,
            'NZD': true, 'SEK': false, 'NOK': false, 'DKK': false, 'PLN': false,
            'MXN': true, 'BRL': true, 'INR': true, 'RUB': false, 'TRY': true,
            'ZAR': true, 'AED': true, 'SAR': true, 'THB': true, 'KRW': true, 'MYR': true
        };
        
        console.log('💱 CurrencyManager initialisé');
    }
    
    async init() {
        try {
            console.log('💱 Début de l\'initialisation de CurrencyManager');
            
            // Charger d'abord les taux
            await this.loadExchangeRates();
            
            // Récupérer la devise depuis localStorage
            const storedCurrency = localStorage.getItem('preferredCurrency');
            
            if (storedCurrency && this.supportedCurrencies.includes(storedCurrency)) {
                this.currentCurrency = storedCurrency;
                console.log(`💱 Devise restaurée: ${this.currentCurrency}`);
            } else {
                await this.detectUserCurrency();
            }
            
            // Initialiser les sélecteurs
            this.initCurrencySelectors();
            
            // Émettre l'événement de prêt
            console.log('✅ CurrencyManager prêt, émission d\'événement');
            window.dispatchEvent(new CustomEvent('currency:ready', {
                detail: { 
                    currency: this.currentCurrency,
                    rates: this.exchangeRates,
                    symbol: this.getSymbol()
                }
            }));
            
            // Émettre aussi un événement global
            window.dispatchEvent(new CustomEvent('currency:initialized'));
            
            return true;
        } catch (error) {
            console.error('❌ Erreur initialisation CurrencyManager:', error);
            
            // Fallback d'urgence
            this.exchangeRates = this.getStaticRates();
            this.exchangeRates['EUR'] = 1;
            this.currentCurrency = 'EUR';
            
            // Émettre quand même l'événement
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
    
    async detectUserCurrency() {
        try {
            // Essayer de détecter via l'API de localisation du navigateur
            const userLocale = navigator.language || navigator.userLanguage;
            const countryCode = userLocale.split('-')[1] || userLocale.split('_')[1];
            
            if (countryCode) {
                // Mapper les codes pays aux devises
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
            
            // Fallback: utiliser le fuseau horaire
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
            
            // Vérifier d'abord le localStorage
            const cachedRates = localStorage.getItem('exchangeRates');
            if (cachedRates) {
                try {
                    const { rates, timestamp, expiresAt } = JSON.parse(cachedRates);
                    const now = Date.now();
                    
                    // Si le cache est valide (moins d'1 heure)
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
            
            // FORCER les taux statiques d'abord (solution d'urgence)
            const staticRates = this.getStaticRates();
            staticRates['EUR'] = 1;
            this.exchangeRates = staticRates;
            
            console.log('💰 Taux statiques chargés (fallback):', Object.keys(staticRates).length + ' devises');
            
            // Essayer les API en parallèle
            const apiSources = [
                'https://api.frankfurter.app/latest?from=EUR',
                'https://api.exchangerate-api.com/v4/latest/EUR',
                'https://open.er-api.com/v6/latest/EUR'
            ];
            
            const apiPromises = apiSources.map(apiUrl => 
                this.fetchExchangeRates(apiUrl).catch(error => {
                    console.log(`⚠️ API ${apiUrl} échouée:`, error.message);
                    return null;
                })
            );
            
            // Attendre la première réponse réussie
            const results = await Promise.allSettled(apiPromises);
            
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value) {
                    // Fusionner avec les taux statiques
                    this.exchangeRates = { ...staticRates, ...result.value };
                    this.exchangeRates['EUR'] = 1;
                    
                    console.log(`✅ Taux API chargés:`, Object.keys(this.exchangeRates).length + ' devises');
                    break;
                }
            }
            
            // Vérifier que les taux essentiels sont présents
            if (!this.exchangeRates['USD']) {
                this.exchangeRates['USD'] = 1.08;
                console.warn('⚠️ USD manquant, valeur par défaut ajoutée');
            }
            
            if (!this.exchangeRates['EUR']) {
                this.exchangeRates['EUR'] = 1;
            }
            
            this.isLoading = false;
            
            // Sauvegarder dans localStorage
            localStorage.setItem('exchangeRates', JSON.stringify({
                rates: this.exchangeRates,
                timestamp: Date.now(),
                expiresAt: Date.now() + 3600000 // 1 heure
            }));
            
            console.log('✅ Taux de change finalisés:', this.exchangeRates);
            
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
                
                // Adapter à différents formats d'API
                let rates = {};
                if (data.rates) {
                    rates = data.rates;
                } else if (data.conversion_rates) {
                    rates = data.conversion_rates;
                } else if (data.rates && data.base) {
                    rates = data.rates;
                }
                
                // Vérifier que nous avons des taux valides
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
        // Taux approximatifs MAINTENU À JOUR (Novembre 2024)
        return {
            'USD': 1.08, 'EUR': 1, 'GBP': 0.86, 'CAD': 1.46, 'AUD': 1.65,
            'CHF': 0.95, 'JPY': 163.5, 'CNY': 7.8, 'SGD': 1.45, 'HKD': 8.45,
            'NZD': 1.78, 'SEK': 11.35, 'NOK': 11.65, 'DKK': 7.46, 'PLN': 4.32,
            'MXN': 18.5, 'BRL': 5.4, 'INR': 90.2, 'RUB': 99.8, 'TRY': 34.9,
            'ZAR': 20.4, 'AED': 3.97, 'SAR': 4.05, 'THB': 38.9, 'KRW': 1445, 'MYR': 5.1
        };
    }
    
    convert(amount, fromCurrency = 'EUR', toCurrency = null) {
        if (!toCurrency) {
            toCurrency = this.currentCurrency;
        }
        
        // Si le montant est invalide
        if (isNaN(amount) || amount === null || amount === undefined) {
            console.warn('❌ Montant invalide pour conversion:', amount);
            return 0;
        }
        
        amount = parseFloat(amount);
        
        // Si la devise source est la même que la cible
        if (fromCurrency === toCurrency) {
            return amount;
        }
        
        // FORCER les taux s'ils sont vides
        if (!this.exchangeRates || Object.keys(this.exchangeRates).length === 0) {
            console.warn('🚨 Taux vides, chargement d\'urgence...');
            this.exchangeRates = this.getStaticRates();
            this.exchangeRates['EUR'] = 1;
        }
        
        let fromRate = this.exchangeRates[fromCurrency];
        let toRate = this.exchangeRates[toCurrency];
        
        // Si les taux sont manquants, utilisez des valeurs par défaut
        if (fromRate === undefined) {
            console.warn(`⚠️ Taux ${fromCurrency} manquant, utilisation 1`);
            fromRate = 1;
        }
        
        if (toRate === undefined) {
            console.warn(`⚠️ Taux ${toCurrency} manquant, utilisation 1`);
            toRate = 1;
        }
        
        // Conversion: (montant / taux_source) * taux_cible
        const amountInEUR = fromCurrency === 'EUR' ? amount : amount / fromRate;
        const convertedAmount = amountInEUR * toRate;
        
        const result = parseFloat(convertedAmount.toFixed(2));
        return result;
    }
    
    formatPrice(amount, currency = null, showSymbol = true) {
        if (!currency) {
            currency = this.currentCurrency;
        }
        
        const convertedAmount = this.convert(amount, 'EUR', currency);
        const symbol = this.currencySymbols[currency] || currency;
        const isSymbolBefore = this.currencyPositions[currency] !== false;
        
        // Formatage selon la devise
        let formattedPrice;
        
        switch(currency) {
            case 'JPY':
            case 'KRW':
            case 'VND':
            case 'IDR':
                // Pas de décimales pour ces devises
                formattedPrice = Math.round(convertedAmount).toLocaleString();
                break;
            case 'INR':
                // Format spécial pour INR
                formattedPrice = convertedAmount.toLocaleString('en-IN', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });
                break;
            default:
                // 2 décimales pour la plupart des devises
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
        
        // Formatage selon la devise
        let formattedPrice;
        
        switch(currency) {
            case 'JPY':
            case 'KRW':
            case 'VND':
            case 'IDR':
                // Pas de décimales pour ces devises
                formattedPrice = Math.round(amount).toLocaleString();
                break;
            case 'INR':
                // Format spécial pour INR
                formattedPrice = amount.toLocaleString('en-IN', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                });
                break;
            default:
                // 2 décimales pour la plupart des devises
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
        
        // Sauvegarder la préférence
        localStorage.setItem('preferredCurrency', currencyCode);
        
        console.log(`💱 Devise changée: ${previousCurrency} → ${currencyCode}`);
        
        // Mettre à jour les sélecteurs immédiatement
        this.updateCurrencySelectors();
        
        // Émettre un événement de changement
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
        
        // Initialiser tous les sélecteurs de devise sur la page
        document.querySelectorAll('select[id^="currencySelector"]').forEach(selector => {
            this.initSingleSelector(selector);
        });
        
        // Initialiser également le sélecteur mobile s'il existe
        const mobileSelector = document.getElementById('currencySelectorMobile');
        if (mobileSelector) {
            this.initSingleSelector(mobileSelector);
        }
        
        console.log('✅ Sélecteurs de devise initialisés');
    }
    
    initSingleSelector(selector) {
        if (!selector) return;
        
        // Vider le sélecteur d'abord
        selector.innerHTML = '';
        
        // Remplir les options
        this.supportedCurrencies.forEach(currency => {
            const option = document.createElement('option');
            option.value = currency;
            const symbol = this.currencySymbols[currency] || currency;
            option.textContent = `${symbol} ${currency}`;
            
            if (currency === this.currentCurrency) {
                option.selected = true;
            }
            
            selector.appendChild(option);
        });
        
        // Écouter les changements
        selector.addEventListener('change', (e) => {
            const newCurrency = e.target.value;
            this.setCurrency(newCurrency);
        });
    }
    
    updateCurrencySelectors() {
        console.log('💱 Mise à jour des sélecteurs de devise');
        
        // Mettre à jour tous les sélecteurs de devise
        document.querySelectorAll('select[id*="currencySelector"]').forEach(selector => {
            if (selector.value !== this.currentCurrency) {
                selector.value = this.currentCurrency;
            }
        });
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
            
            // Sauvegarder l'ancienne devise pour pouvoir revenir si nécessaire
            const previousCurrency = this.currentCurrency;
            localStorage.setItem('previousCurrency', previousCurrency);
            
            // Changer la devise
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
    
    // MÉTHODE VIP: Conversion intelligente des prix VIP
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
        
        // SI MÊME DEVISE: PAS DE CONVERSION, retour direct
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
        
        // CONVERSION NÉCESSAIRE - UTILISER LES TAUX DE CHANGE ACTUELS
        const fromRate = this.exchangeRates[originalCurrency];
        const toRate = this.exchangeRates[targetCurrency];
        
        if (!fromRate || !toRate) {
            console.warn(`⚠️ Taux non disponibles pour ${originalCurrency} → ${targetCurrency}`);
            console.warn('Taux disponibles:', Object.keys(this.exchangeRates));
            
            // Fallback: utiliser EUR comme intermédiaire
            const toEUR = this.exchangeRates[originalCurrency] || 1;
            const fromEUR = this.exchangeRates[targetCurrency] || 1;
            
            if (toEUR && fromEUR) {
                const amountInEUR = originalPrice / toEUR;
                const finalPrice = amountInEUR * fromEUR;
                
                console.log(`💱 Conversion via EUR: ${originalPrice} ${originalCurrency} → ${amountInEUR.toFixed(2)} EUR → ${finalPrice.toFixed(2)} ${targetCurrency}`);
                
                return {
                    price: finalPrice,
                    currency: targetCurrency,
                    originalPrice: originalPrice,
                    originalCurrency: originalCurrency,
                    display: this.formatPriceInCurrency(finalPrice, targetCurrency),
                    converted: true
                };
            } else {
                console.warn('⚠️ Conversion impossible, prix original retourné');
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
        
        // Conversion directe
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
    
    // MÉTHODE VIP: Formater simplement, sans indication de conversion
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
    
    // Méthode pour formater un montant avec la devise et le symbole
    formatWithSymbol(amount, currency = null) {
        if (!currency) {
            currency = this.currentCurrency;
        }
        
        const formatted = this.formatPriceInCurrency(amount, currency, false);
        const symbol = this.currencySymbols[currency] || currency;
        const isSymbolBefore = this.currencyPositions[currency] !== false;
        
        return isSymbolBefore ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
    }
    
    // Méthode pour arrondir selon les règles de la devise
    roundForCurrency(amount, currency = null) {
        if (!currency) {
            currency = this.currentCurrency;
        }
        
        switch(currency) {
            case 'JPY':
            case 'KRW':
            case 'VND':
            case 'IDR':
                return Math.round(amount);
            default:
                return Math.round(amount * 100) / 100;
        }
    }
    
    // Méthode pour obtenir toutes les informations sur une devise
    getCurrencyInfo(currency = null) {
        if (!currency) {
            currency = this.currentCurrency;
        }
        
        return {
            code: currency,
            symbol: this.currencySymbols[currency] || currency,
            position: this.currencyPositions[currency] !== false ? 'before' : 'after',
            decimals: ['JPY', 'KRW', 'VND', 'IDR'].includes(currency) ? 0 : 2,
            isSupported: this.supportedCurrencies.includes(currency),
            exchangeRate: this.exchangeRates[currency] || 1
        };
    }
}

// Initialiser et exposer globalement
window.currencyManager = new CurrencyManager();

// Initialiser automatiquement quand le DOM est chargé
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

// Fonction de debug URGENTE
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
    
    // Test des taux clés
    console.log('\n💱 Taux de change clés:');
    const keyRates = ['EUR', 'USD', 'CAD', 'GBP', 'AUD', 'JPY', 'CHF'];
    keyRates.forEach(currency => {
        console.log(`${currency}:`, cm.exchangeRates[currency]);
    });
    
    // Test de conversion
    console.log('\n🧪 Test de conversion standard:');
    console.log('10 EUR → USD:', cm.convert(10, 'EUR', 'USD'));
    console.log('10 EUR → CAD:', cm.convert(10, 'EUR', 'CAD'));
    console.log('10 EUR → EUR:', cm.convert(10, 'EUR', 'EUR'));
    console.log('10 USD → EUR:', cm.convert(10, 'USD', 'EUR'));
    
    // Test VIP
    console.log('\n👑 Test conversion VIP:');
    const testVipData = { price: 3, currency: 'USD' };
    const convertedVIP = cm.convertVIPPrice(testVipData, 'EUR');
    console.log('3 USD → EUR (VIP):', convertedVIP);
    
    // Test formatage
    console.log('\n💰 Test formatage:');
    console.log('Format 10 EUR:', cm.formatPrice(10));
    console.log('Format 10 USD:', cm.formatPrice(10, 'USD'));
    console.log('Format 10 JPY:', cm.formatPrice(10, 'JPY'));
    console.log('Format 10 CAD:', cm.formatPrice(10, 'CAD'));
    
    // Test forfait VIP
    console.log('\n📦 Test forfait VIP (10 cours à 3$ avec 5% réduction):');
    const vipUnitPrice = 3;
    const quantity = 10;
    const discount = 5;
    const totalVipUSD = vipUnitPrice * quantity * (1 - discount/100);
    console.log(`Calcul: ${vipUnitPrice}$ × ${quantity} × (1 - ${discount}%) = ${totalVipUSD.toFixed(2)}$`);
    
    if (cm.currentCurrency !== 'USD') {
        const convertedTotal = cm.convert(totalVipUSD, 'USD', cm.currentCurrency);
        console.log(`Conversion: ${totalVipUSD.toFixed(2)}$ → ${convertedTotal.toFixed(2)} ${cm.currentCurrency}`);
    }
    
    console.groupEnd();
};

// Fonction de test des forfaits VIP
window.testVipPackages = () => {
    console.group('🧪 TEST FORFAITS VIP');
    
    // Prix VIP: 3 USD par cours
    const vipPrice = 3;
    const vipCurrency = 'USD';
    
    const testCases = [
        { quantity: 1, discount: 0, description: '1 cours - pas de réduction' },
        { quantity: 5, discount: 2, description: '5 cours - 2% réduction' },
        { quantity: 10, discount: 5, description: '10 cours - 5% réduction' }
    ];
    
    testCases.forEach(testCase => {
        console.log(`\n📊 ${testCase.description}`);
        const total = vipPrice * testCase.quantity * (1 - testCase.discount/100);
        console.log(`Calcul: ${vipPrice}${vipCurrency} × ${testCase.quantity} × (1 - ${testCase.discount}%) = ${total.toFixed(2)}${vipCurrency}`);
        
        if (window.currencyManager && window.currencyManager.currentCurrency !== vipCurrency) {
            const converted = window.currencyManager.convert(total, vipCurrency, window.currencyManager.currentCurrency);
            console.log(`Conversion: ${total.toFixed(2)}${vipCurrency} → ${converted.toFixed(2)}${window.currencyManager.currentCurrency}`);
        }
    });
    
    console.groupEnd();
};

// FORCER le debug au chargement si problème
if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
    // Test automatique après chargement
    setTimeout(() => {
        console.log('🧪 Test automatique CurrencyManager après 3 secondes...');
        
        if (!window.currencyManager || 
            !window.currencyManager.exchangeRates || 
            Object.keys(window.currencyManager.exchangeRates).length === 0) {
            console.warn('🚨 DÉTECTION: Taux vides, appel debug automatique');
            window.debugCurrency();
        }
        
        // Test des forfaits VIP
        console.log('\n🎁 Test automatique des forfaits VIP');
        window.testVipPackages();
    }, 3000);
}
// FONCTION DE DEBUG GLOBALE
window.debugVIPPriceIssue = function() {
    console.group('🔍 DEBUG PRIX VIP');
    
    // 1. Vérifier CurrencyManager
    if (window.currencyManager) {
        console.log('💱 CurrencyManager:');
        console.log('- Devise courante:', window.currencyManager.currentCurrency);
        console.log('- Symbole:', window.currencyManager.getSymbol());
        console.log('- Taux USD:', window.currencyManager.exchangeRates['USD']);
        console.log('- Taux EUR:', window.currencyManager.exchangeRates['EUR']);
    }
    
    // 2. Vérifier AuthManager
    if (window.authManager) {
        console.log('🔐 AuthManager:');
        console.log('- Utilisateur VIP:', window.authManager.isUserVip());
        console.log('- Utilisateur:', window.authManager.user?.email);
        console.log('- Prix VIP chargés:', window.authManager.user?.vipPrices);
    }
    
    // 3. Test de conversion
    console.log('🧪 Test conversion 28.50 USD:');
    const testAmount = 28.50;
    if (window.currencyManager) {
        const converted = window.currencyManager.convert(testAmount, 'USD', window.currencyManager.currentCurrency);
        console.log(`${testAmount} USD → ${converted.toFixed(2)} ${window.currencyManager.currentCurrency}`);
        
        // Taux implicite
        const implicitRate = converted / testAmount;
        console.log(`Taux implicite USD→${window.currencyManager.currentCurrency}:`, implicitRate.toFixed(4));
    }
    
    // 4. Calcul manuel
    console.log('🧮 Calcul manuel:');
    const vipPrice = 3; // USD
    const quantity = 10;
    const discount = 5; // %
    
    const totalUSD = vipPrice * quantity * (1 - discount/100);
    console.log(`3 USD × 10 × (1 - 5%) = ${totalUSD.toFixed(2)} USD`);
    
    if (window.currencyManager) {
        const convertedTotal = window.currencyManager.convert(totalUSD, 'USD', window.currencyManager.currentCurrency);
        console.log(`→ ${convertedTotal.toFixed(2)} ${window.currencyManager.currentCurrency}`);
    }
    
    console.groupEnd();
};
// Export pour Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CurrencyManager };
}