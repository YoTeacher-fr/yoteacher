// currency.js - Gestionnaire de conversion de devises pour YoTeacher

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
        
        console.log('💱 CurrencyManager initialisé');
    }
    
    async init() {
        try {
            // Récupérer la devise depuis localStorage
            const storedCurrency = localStorage.getItem('preferredCurrency');
            
            if (storedCurrency && this.supportedCurrencies.includes(storedCurrency)) {
                this.currentCurrency = storedCurrency;
                console.log(`💱 Devise restaurée: ${this.currentCurrency}`);
            } else {
                // Détection automatique de la devise
                await this.detectUserCurrency();
            }
            
            // Charger les taux de change
            await this.loadExchangeRates();
            
            // Initialiser les sélecteurs de devise
            this.initCurrencySelectors();
            
            // Émettre un événement pour informer que la devise est prête
            window.dispatchEvent(new CustomEvent('currency:ready', {
                detail: { currency: this.currentCurrency }
            }));
            
            return true;
        } catch (error) {
            console.error('❌ Erreur initialisation CurrencyManager:', error);
            return false;
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
                    'BE': 'EUR', 'PT': 'EUR', 'IE': 'EUR', 'AT': 'EUR', 'FI': 'EUR'
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
            
            if (timezone.includes('America/New_York') || timezone.includes('America/Los_Angeles')) {
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
            
            // Essayer plusieurs sources d'API de taux de change
            const apiSources = [
                'https://api.exchangerate-api.com/v4/latest/EUR',
                'https://api.frankfurter.app/latest?from=EUR',
                'https://open.er-api.com/v6/latest/EUR'
            ];
            
            let ratesLoaded = false;
            
            for (const apiUrl of apiSources) {
                try {
                    console.log(`💱 Chargement taux depuis: ${apiUrl}`);
                    const response = await fetch(apiUrl);
                    
                    if (!response.ok) continue;
                    
                    const data = await response.json();
                    
                    if (data.rates) {
                        this.exchangeRates = data.rates;
                        ratesLoaded = true;
                        console.log('✅ Taux de change chargés');
                        break;
                    }
                } catch (error) {
                    console.warn(`⚠️ Erreur API ${apiUrl}:`, error.message);
                    continue;
                }
            }
            
            // Fallback: taux statiques si les API échouent
            if (!ratesLoaded) {
                console.warn('⚠️ Utilisation taux statiques');
                this.exchangeRates = this.getStaticRates();
            }
            
            // S'assurer que l'EUR a un taux de 1
            this.exchangeRates['EUR'] = 1;
            
            this.isLoading = false;
            
            // Sauvegarder les taux dans localStorage (valide 24h)
            localStorage.setItem('exchangeRates', JSON.stringify({
                rates: this.exchangeRates,
                timestamp: Date.now()
            }));
            
        } catch (error) {
            console.error('❌ Erreur chargement taux:', error);
            this.exchangeRates = this.getStaticRates();
            this.isLoading = false;
        }
    }
    
    getStaticRates() {
        // Taux approximatifs
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
        
        // Si la devise source est la même que la cible
        if (fromCurrency === toCurrency) {
            return parseFloat(amount);
        }
        
        // Vérifier que nous avons les taux nécessaires
        const fromRate = this.exchangeRates[fromCurrency];
        const toRate = this.exchangeRates[toCurrency];
        
        if (!fromRate || !toRate) {
            console.warn(`❌ Taux manquant: ${fromCurrency}=${fromRate}, ${toCurrency}=${toRate}`);
            return parseFloat(amount);
        }
        
        // Conversion: (montant / taux_source) * taux_cible
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
        
        // Formatage selon la devise
        let formattedPrice;
        
        switch(currency) {
            case 'JPY':
            case 'KRW':
            case 'INR':
                // Pas de décimales pour ces devises
                formattedPrice = Math.round(convertedAmount).toLocaleString();
                break;
            default:
                // 2 décimales pour la plupart des devises
                formattedPrice = convertedAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
        }
        
        return showSymbol ? `${symbol}${formattedPrice}` : formattedPrice;
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
        // Initialiser tous les sélecteurs de devise sur la page
        document.querySelectorAll('select[id^="currencySelector"]').forEach(selector => {
            // Remplir les options
            this.supportedCurrencies.forEach(currency => {
                const option = document.createElement('option');
                option.value = currency;
                option.textContent = `${this.currencySymbols[currency] || currency} ${currency}`;
                
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
        });
        
        console.log('✅ Sélecteurs de devise initialisés');
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
            return this.setCurrency('CAD');
        }
        return true;
    }
}

// Initialiser et exposer globalement
window.currencyManager = new CurrencyManager();

// Initialiser automatiquement quand le DOM est chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.currencyManager.init();
    });
} else {
    window.currencyManager.init();
}

// Fonctions utilitaires globales
window.formatCurrency = (amount, currency = null) => {
    return window.currencyManager?.formatPrice(amount, currency) || `${amount}€`;
};

window.convertCurrency = (amount, from = 'EUR', to = null) => {
    return window.currencyManager?.convert(amount, from, to) || amount;
};

// Debug
window.debugCurrency = () => {
    console.group('💱 Debug CurrencyManager');
    console.log('Devise actuelle:', window.currencyManager?.currentCurrency);
    console.log('Symbol:', window.currencyManager?.getSymbol());
    console.log('Taux chargés:', !!window.currencyManager?.exchangeRates);
    console.log('Taux EUR→USD:', window.currencyManager?.exchangeRates['USD']);
    console.log('Exemple 10€ →:', window.currencyManager?.formatPrice(10));
    console.groupEnd();
};