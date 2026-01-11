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
            
            // Charger les taux de change IMMÉDIATEMENT
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
            
            // Fallback d'urgence
            this.exchangeRates = this.getStaticRates();
            this.exchangeRates['EUR'] = 1;
            
            return true; // Continuer même en cas d'erreur
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
            
            console.log('💱 Début du chargement des taux de change');
            
            // FORCER les taux statiques d'abord (solution d'urgence)
            const staticRates = this.getStaticRates();
            staticRates['EUR'] = 1;
            this.exchangeRates = staticRates;
            
            console.log('💰 Taux statiques chargés (fallback):', staticRates);
            
            // Essayer ensuite les API en parallèle
            const apiSources = [
                'https://api.frankfurter.app/latest?from=EUR',
                'https://api.exchangerate-api.com/v4/latest/EUR',
                'https://open.er-api.com/v6/latest/EUR'
            ];
            
            // Tenter les API sans bloquer
            for (const apiUrl of apiSources) {
                try {
                    console.log(`🔗 Tentative API: ${apiUrl}`);
                    const response = await fetch(apiUrl, { timeout: 5000 });
                    
                    if (response && response.ok) {
                        const data = await response.json();
                        
                        if (data.rates && data.rates['USD'] && data.rates['EUR']) {
                            // Fusionner avec les taux statiques (les taux API remplacent les statiques)
                            this.exchangeRates = { ...staticRates, ...data.rates };
                            this.exchangeRates['EUR'] = 1; // Toujours 1
                            
                            console.log(`✅ Taux API chargés de ${apiUrl.split('/')[2]}`);
                            console.log('💰 Taux fusionnés:', this.exchangeRates);
                            break; // Sortir dès qu'une API réussit
                        }
                    }
                } catch (apiError) {
                    console.log(`⚠️ API ${apiUrl} échouée, continuation avec taux statiques`);
                    continue;
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
            
            // Sauvegarder dans localStorage (valide 1h)
            localStorage.setItem('exchangeRates', JSON.stringify({
                rates: this.exchangeRates,
                timestamp: Date.now(),
                expiresAt: Date.now() + 3600000 // 1 heure
            }));
            
            console.log('✅ Taux de change finalisés:', this.exchangeRates);
            
            // Émettre un événement
            window.dispatchEvent(new CustomEvent('exchangeRates:loaded', {
                detail: { rates: this.exchangeRates }
            }));
            
            return this.exchangeRates;
            
        } catch (error) {
            console.error('❌ Erreur critique chargement taux:', error);
            
            // Fallback absolu
            this.exchangeRates = this.getStaticRates();
            this.exchangeRates['EUR'] = 1;
            this.isLoading = false;
            
            return this.exchangeRates;
        }
    }
    
    getStaticRates() {
        // Taux approximatifs MAINTENU À JOUR
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
        
        console.log(`💱 Conversion: ${amount} ${fromCurrency} (${fromRate}) → ${toCurrency} (${toRate})`);
        
        // Conversion: (montant / taux_source) * taux_cible
        const amountInEUR = fromCurrency === 'EUR' ? amount : amount / fromRate;
        const convertedAmount = amountInEUR * toRate;
        
        const result = parseFloat(convertedAmount.toFixed(2));
        console.log(`✅ Résultat: ${result} ${toCurrency}`);
        
        return result;
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
    // NOUVELLE MÉTHODE: Formater un prix dans une devise spécifique SANS conversion
formatPriceInCurrency(amount, currency, showSymbol = true) {
    const symbol = this.currencySymbols[currency] || currency;
    
    // Formatage selon la devise
    let formattedPrice;
    
    switch(currency) {
        case 'JPY':
        case 'KRW':
        case 'INR':
            // Pas de décimales pour ces devises
            formattedPrice = Math.round(amount).toLocaleString();
            break;
        default:
            // 2 décimales pour la plupart des devises
            formattedPrice = amount.toLocaleString(undefined, {
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
        // Initialiser tous les sélecteurs de devise sur la page
        document.querySelectorAll('select[id^="currencySelector"]').forEach(selector => {
            // Vider le sélecteur d'abord
            selector.innerHTML = '';
            
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
        
        // Initialiser également le sélecteur mobile s'il existe
        const mobileSelector = document.getElementById('currencySelectorMobile');
        if (mobileSelector) {
            mobileSelector.innerHTML = '';
            
            this.supportedCurrencies.forEach(currency => {
                const option = document.createElement('option');
                option.value = currency;
                option.textContent = `${this.currencySymbols[currency] || currency} ${currency}`;
                
                if (currency === this.currentCurrency) {
                    option.selected = true;
                }
                
                mobileSelector.appendChild(option);
            });
            
            mobileSelector.addEventListener('change', (e) => {
                const newCurrency = e.target.value;
                this.setCurrency(newCurrency);
            });
        }
        
        console.log('✅ Sélecteurs de devise initialisés');
    }
    
    updateCurrencySelectors() {
        // Mettre à jour tous les sélecteurs de devise
        document.querySelectorAll('select[id*="currencySelector"]').forEach(selector => {
            if (selector.value !== this.currentCurrency) {
                selector.value = this.currentCurrency;
                console.log(`💱 Sélecteur ${selector.id} mis à jour: ${selector.value} → ${this.currentCurrency}`);
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
    
    // MÉTHODE VIP SIMPLIFIÉE: Conversion intelligente des prix VIP
convertVIPPrice(vipPriceData, targetCurrency = null) {
    if (!vipPriceData || vipPriceData.price === undefined) {
        console.warn('❌ Données VIP manquantes pour conversion');
        return null;
    }
    
    if (!targetCurrency) {
        targetCurrency = this.currentCurrency;
    }
    
    const originalPrice = parseFloat(vipPriceData.price);
    const originalCurrency = vipPriceData.currency || 'EUR';
    
    console.log(`💱 Conversion VIP: ${originalPrice} ${originalCurrency} → ${targetCurrency}`);
    
    // SI MÊME DEVISE: PAS DE CONVERSION, retour direct
    if (originalCurrency === targetCurrency) {
        console.log('✅ Même devise, pas de conversion');
        return {
            price: originalPrice,
            currency: targetCurrency,
            originalPrice: originalPrice,
            originalCurrency: originalCurrency,
            display: this.formatPriceInCurrency(originalPrice, targetCurrency),
            converted: false
        };
    }
    
    // CONVERSION NÉCESSAIRE
    const fromRate = this.exchangeRates[originalCurrency] || 1;
    const toRate = this.exchangeRates[targetCurrency] || 1;
    
    if (!fromRate || !toRate) {
        console.warn('⚠️ Taux non disponibles, pas de conversion');
        return {
            price: originalPrice,
            currency: originalCurrency,
            originalPrice: originalPrice,
            originalCurrency: originalCurrency,
            display: this.formatPriceInCurrency(originalPrice, originalCurrency),
            converted: false
        };
    }
    
    const amountInEUR = originalPrice / fromRate;
    const finalPrice = amountInEUR * toRate;
    
    console.log(`✅ Conversion VIP réussie: ${finalPrice.toFixed(2)} ${targetCurrency}`);
    
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
    
    // Retourner uniquement le prix affiché, sans annotation
    return converted.display;
}

// Initialiser et exposer globalement
window.currencyManager = new CurrencyManager();

// Initialiser automatiquement quand le DOM est chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🌍 DOM chargé, initialisation CurrencyManager');
        window.currencyManager.init().then(() => {
            console.log('✅ CurrencyManager initialisé avec succès');
        });
    });
} else {
    console.log('🌍 DOM déjà chargé, initialisation CurrencyManager');
    window.currencyManager.init().then(() => {
        console.log('✅ CurrencyManager initialisé avec succès');
    });
}

// Fonctions utilitaires globales
window.formatCurrency = (amount, currency = null) => {
    return window.currencyManager?.formatPrice(amount, currency) || `${amount}€`;
};

window.convertCurrency = (amount, from = 'EUR', to = null) => {
    return window.currencyManager?.convert(amount, from, to) || amount;
};

// Fonction de debug URGENTE
window.debugCurrency = () => {
    console.group('🚨 URGENCE - Debug CurrencyManager');
    
    if (!window.currencyManager) {
        console.error('❌ currencyManager non disponible');
        console.groupEnd();
        return;
    }
    
    console.log('Devise actuelle:', window.currencyManager.currentCurrency);
    console.log('Taux chargés:', window.currencyManager.exchangeRates);
    console.log('Taille taux:', Object.keys(window.currencyManager.exchangeRates || {}).length);
    console.log('Est en chargement:', window.currencyManager.isLoading);
    
    // Test des taux clés
    const keyRates = ['EUR', 'USD', 'CAD', 'GBP'];
    keyRates.forEach(currency => {
        console.log(`${currency}:`, window.currencyManager.exchangeRates[currency]);
    });
    
    // Test de conversion
    console.log('\n🧪 Test de conversion:');
    console.log('10 EUR → USD:', window.currencyManager.convert(10, 'EUR', 'USD'));
    console.log('3 USD → EUR:', window.currencyManager.convert(3, 'USD', 'EUR'));
    console.log('3 USD → USD:', window.currencyManager.convert(3, 'USD', 'USD'));
    
    // Test VIP
    console.log('\n🧪 Test VIP:');
    const testVipData = { price: 3, currency: 'USD' };
    const converted = window.currencyManager.convertVIPPrice(testVipData, 'EUR');
    console.log('3 USD → EUR (VIP):', converted);
    
    console.groupEnd();
};

// FORCER le debug au chargement si problème
if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
    setTimeout(() => {
        if (!window.currencyManager || 
            !window.currencyManager.exchangeRates || 
            Object.keys(window.currencyManager.exchangeRates).length === 0) {
            console.warn('🚨 DÉTECTION: Taux vides, appel debug automatique');
            window.debugCurrency();
        }
    }, 3000);
}