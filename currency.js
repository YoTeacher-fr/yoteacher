// currency.js - Gestionnaire de conversion de devises
class CurrencyManager {
    constructor() {
        this.defaultCurrency = 'EUR';
        this.currentCurrency = 'EUR';
        this.exchangeRates = {};
        this.userLocation = null;
        
        // Devises supportées
        this.supportedCurrencies = {
            'EUR': { symbol: '€', name: 'Euro', flag: '🇪🇺' },
            'USD': { symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
            'CAD': { symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦' },
            'GBP': { symbol: '£', name: 'British Pound', flag: '🇬🇧' },
            'CHF': { symbol: 'CHF', name: 'Swiss Franc', flag: '🇨🇭' },
            'AUD': { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
            'JPY': { symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' }
        };
        
        // Mapping pays -> devise
        this.countryToCurrency = {
            'FR': 'EUR', 'DE': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'BE': 'EUR', 'NL': 'EUR',
            'US': 'USD',
            'CA': 'CAD',
            'GB': 'GBP',
            'CH': 'CHF',
            'AU': 'AUD',
            'JP': 'JPY'
        };
        
        this.init();
    }
    
    async init() {
        try {
            // Détecter la localisation
            await this.detectUserLocation();
            
            // Charger les taux de change
            await this.fetchExchangeRates();
            
            // Définir la devise selon la localisation
            this.setDefaultCurrency();
            
            console.log('💱 CurrencyManager initialisé:', {
                location: this.userLocation,
                currency: this.currentCurrency,
                rates: this.exchangeRates
            });
            
        } catch (error) {
            console.error('❌ Erreur initialisation CurrencyManager:', error);
            this.currentCurrency = this.defaultCurrency;
        }
    }
    
    async detectUserLocation() {
        try {
            // Essayer d'abord avec l'API de géolocalisation IP
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            this.userLocation = {
                country: data.country_code,
                countryName: data.country_name,
                city: data.city,
                timezone: data.timezone
            };
            
            console.log('📍 Localisation détectée:', this.userLocation);
            
        } catch (error) {
            console.warn('⚠️ Impossible de détecter la localisation:', error);
            // Fallback : utiliser le timezone du navigateur
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            this.userLocation = {
                country: 'FR', // Par défaut
                timezone: timezone
            };
        }
    }
    
    async fetchExchangeRates() {
        try {
            // Utiliser l'API ExchangeRate-API (gratuite)
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');
            const data = await response.json();
            
            this.exchangeRates = data.rates;
            console.log('✅ Taux de change chargés');
            
        } catch (error) {
            console.warn('⚠️ Impossible de charger les taux de change, utilisation des taux par défaut');
            // Taux approximatifs par défaut
            this.exchangeRates = {
                'EUR': 1,
                'USD': 1.09,
                'CAD': 1.48,
                'GBP': 0.86,
                'CHF': 0.95,
                'AUD': 1.66,
                'JPY': 162.0
            };
        }
    }
    
    setDefaultCurrency() {
        if (this.userLocation && this.userLocation.country) {
            const detectedCurrency = this.countryToCurrency[this.userLocation.country];
            if (detectedCurrency && this.supportedCurrencies[detectedCurrency]) {
                this.currentCurrency = detectedCurrency;
            }
        }
        
        // Sauvegarder dans localStorage
        localStorage.setItem('selectedCurrency', this.currentCurrency);
    }
    
    convert(amount, fromCurrency = 'EUR', toCurrency = null) {
        if (!toCurrency) {
            toCurrency = this.currentCurrency;
        }
        
        if (fromCurrency === toCurrency) {
            return amount;
        }
        
        // Conversion via EUR comme base
        const amountInEur = fromCurrency === 'EUR' 
            ? amount 
            : amount / this.exchangeRates[fromCurrency];
        
        const convertedAmount = toCurrency === 'EUR'
            ? amountInEur
            : amountInEur * this.exchangeRates[toCurrency];
        
        return Math.round(convertedAmount * 100) / 100;
    }
    
    format(amount, currency = null) {
        if (!currency) {
            currency = this.currentCurrency;
        }
        
        const currencyInfo = this.supportedCurrencies[currency];
        const symbol = currencyInfo ? currencyInfo.symbol : currency;
        
        // Formatter selon la devise
        if (currency === 'JPY') {
            return `${symbol}${Math.round(amount)}`;
        }
        
        return `${amount.toFixed(2)}${symbol}`;
    }
    
    setCurrency(currency) {
        if (this.supportedCurrencies[currency]) {
            this.currentCurrency = currency;
            localStorage.setItem('selectedCurrency', currency);
            
            // Émettre un événement pour mettre à jour l'UI
            window.dispatchEvent(new CustomEvent('currencyChanged', {
                detail: { currency: currency }
            }));
            
            return true;
        }
        return false;
    }
    
    getCurrentCurrency() {
        return this.currentCurrency;
    }
    
    getSupportedCurrencies() {
        return this.supportedCurrencies;
    }
    
    getCurrencyInfo(currency = null) {
        if (!currency) {
            currency = this.currentCurrency;
        }
        return this.supportedCurrencies[currency];
    }
    
    // Créer un sélecteur de devise
    createCurrencySelector(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const selector = document.createElement('div');
        selector.className = 'currency-selector';
        selector.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
        `;
        
        selector.innerHTML = `
            <span style="font-size: 1.2rem;">${this.getCurrencyInfo().flag}</span>
            <span style="font-weight: 600;">${this.currentCurrency}</span>
            <i class="fas fa-chevron-down" style="font-size: 0.8rem;"></i>
        `;
        
        // Menu déroulant
        const dropdown = document.createElement('div');
        dropdown.className = 'currency-dropdown';
        dropdown.style.cssText = `
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            min-width: 200px;
            margin-top: 5px;
        `;
        
        Object.entries(this.supportedCurrencies).forEach(([code, info]) => {
            const option = document.createElement('div');
            option.style.cssText = `
                padding: 12px 15px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: background 0.2s;
            `;
            
            option.innerHTML = `
                <span style="font-size: 1.2rem;">${info.flag}</span>
                <span style="font-weight: 500;">${code}</span>
                <span style="color: #666; font-size: 0.9rem;">${info.name}</span>
            `;
            
            option.addEventListener('mouseenter', () => {
                option.style.background = '#f0f7ff';
            });
            
            option.addEventListener('mouseleave', () => {
                option.style.background = 'white';
            });
            
            option.addEventListener('click', () => {
                this.setCurrency(code);
                selector.innerHTML = `
                    <span style="font-size: 1.2rem;">${info.flag}</span>
                    <span style="font-weight: 600;">${code}</span>
                    <i class="fas fa-chevron-down" style="font-size: 0.8rem;"></i>
                `;
                dropdown.style.display = 'none';
            });
            
            dropdown.appendChild(option);
        });
        
        // Toggle dropdown
        selector.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });
        
        // Fermer en cliquant ailleurs
        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });
        
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.appendChild(selector);
        wrapper.appendChild(dropdown);
        
        container.appendChild(wrapper);
    }
}

// Initialiser
window.currencyManager = new CurrencyManager();

console.log('💱 CurrencyManager prêt');
