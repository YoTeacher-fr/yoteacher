// currency.js - Système complet de gestion des devises
class CurrencyManager {
    constructor() {
        this.availableCurrencies = [
            { code: 'EUR', name: 'Euro', symbol: '€', country: '🇪🇺' },
            { code: 'USD', name: 'US Dollar', symbol: '$', country: '🇺🇸' },
            { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', country: '🇨🇦' },
            { code: 'GBP', name: 'British Pound', symbol: '£', country: '🇬🇧' },
            { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', country: '🇨🇭' },
            { code: 'JPY', name: 'Japanese Yen', symbol: '¥', country: '🇯🇵' },
            { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', country: '🇦🇺' },
            { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', country: '🇨🇳' },
            { code: 'INR', name: 'Indian Rupee', symbol: '₹', country: '🇮🇳' },
            { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', country: '🇧🇷' },
            { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', country: '🇲🇽' }
        ];
        
        this.currentCurrency = 'EUR';
        this.exchangeRates = {};
        this.baseCurrency = 'EUR';
        this.rateCacheDuration = 3600000; // 1 heure
        
        this.loadSavedCurrency();
        this.init();
    }

    async init() {
        await this.fetchExchangeRates();
        if (!this.currentCurrency) {
            await this.detectCurrency();
        }
        this.setupCurrencyWidget();
    }

    async fetchExchangeRates() {
        try {
            const cacheKey = 'exchangeRatesCache';
            const cacheTimeKey = 'exchangeRatesTime';
            
            // Vérifier le cache
            const cached = localStorage.getItem(cacheKey);
            const cachedTime = localStorage.getItem(cacheTimeKey);
            
            if (cached && cachedTime) {
                const timeDiff = Date.now() - parseInt(cachedTime);
                if (timeDiff < this.rateCacheDuration) {
                    this.exchangeRates = JSON.parse(cached);
                    console.log('📊 Taux chargés depuis le cache');
                    return;
                }
            }
            
            // Récupérer les taux
            const response = await fetch('https://api.exchangerate.host/latest?base=EUR');
            const data = await response.json();
            
            this.exchangeRates = data.rates || {};
            
            // Mettre en cache
            localStorage.setItem(cacheKey, JSON.stringify(this.exchangeRates));
            localStorage.setItem(cacheTimeKey, Date.now().toString());
            
            console.log('📊 Taux de change actualisés:', this.exchangeRates);
            
        } catch (error) {
            console.error('❌ Erreur taux de change:', error);
            this.setFallbackRates();
        }
    }

    setFallbackRates() {
        this.exchangeRates = {
            'EUR': 1,
            'USD': 1.08,
            'CAD': 1.46,
            'GBP': 0.85,
            'CHF': 0.95,
            'JPY': 158.34,
            'AUD': 1.65,
            'CNY': 7.79,
            'INR': 89.67,
            'BRL': 5.36,
            'MXN': 18.15
        };
    }

    async detectCurrency() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            const countryCurrency = data.currency;
            if (countryCurrency && this.availableCurrencies.find(c => c.code === countryCurrency)) {
                this.currentCurrency = countryCurrency;
            } else {
                this.currentCurrency = 'EUR';
            }
            
            console.log('📍 Devise détectée:', this.currentCurrency, 'pour', data.country_name);
            this.saveCurrency();
            
        } catch (error) {
            console.error('⚠️ Erreur détection devise:', error);
            this.currentCurrency = 'EUR';
        }
    }

    loadSavedCurrency() {
        const saved = localStorage.getItem('selectedCurrency');
        if (saved && this.availableCurrencies.find(c => c.code === saved)) {
            this.currentCurrency = saved;
        }
    }

    saveCurrency() {
        localStorage.setItem('selectedCurrency', this.currentCurrency);
    }

    setCurrency(currencyCode) {
        if (this.availableCurrencies.find(c => c.code === currencyCode)) {
            this.currentCurrency = currencyCode;
            this.saveCurrency();
            
            window.dispatchEvent(new CustomEvent('currencyChanged', { 
                detail: { 
                    currency: currencyCode,
                    symbol: this.getCurrencySymbol(currencyCode)
                } 
            }));
            
            return true;
        }
        return false;
    }

    getCurrentCurrency() {
        return this.currentCurrency;
    }

    getCurrencySymbol(currencyCode = null) {
        const code = currencyCode || this.currentCurrency;
        const currency = this.availableCurrencies.find(c => c.code === code);
        return currency ? currency.symbol : '€';
    }

    convert(amount, fromCurrency = 'EUR', toCurrency = null) {
        if (!toCurrency) toCurrency = this.currentCurrency;
        if (fromCurrency === toCurrency) return amount;
        
        if (!this.exchangeRates[fromCurrency] || !this.exchangeRates[toCurrency]) {
            console.warn(`Taux manquant pour ${fromCurrency} -> ${toCurrency}`);
            return amount;
        }
        
        const amountInEUR = fromCurrency === 'EUR' ? amount : amount / this.exchangeRates[fromCurrency];
        const converted = amountInEUR * this.exchangeRates[toCurrency];
        return Math.round(converted * 100) / 100;
    }

    format(amount, currencyCode = null, showCode = false) {
        const code = currencyCode || this.currentCurrency;
        const symbol = this.getCurrencySymbol(code);
        const converted = this.convert(amount, 'EUR', code);
        
        try {
            const formatter = new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: code,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            
            let formatted = formatter.format(converted);
            if (showCode) {
                formatted += ` (${code})`;
            }
            return formatted;
            
        } catch (error) {
            return `${symbol}${converted.toFixed(2)}`;
        }
    }

    getAvailableCurrencies() {
        return this.availableCurrencies;
    }

    // Nouveau: Widget de sélection de devise
    setupCurrencyWidget() {
        const widgetHTML = `
            <div class="currency-widget">
                <button class="currency-toggle" id="currencyToggle">
                    <span class="currency-flag">${this.getCurrencyFlag()}</span>
                    <span class="currency-code">${this.currentCurrency}</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="currency-dropdown" id="currencyDropdown">
                    <div class="currency-search">
                        <input type="text" placeholder="Rechercher une devise..." id="currencySearch">
                        <i class="fas fa-search"></i>
                    </div>
                    <div class="currency-list" id="currencyList">
                        ${this.generateCurrencyList()}
                    </div>
                </div>
            </div>
        `;
        
        // Injecter le widget si nécessaire
        if (!document.querySelector('.currency-widget')) {
            document.body.insertAdjacentHTML('beforeend', widgetHTML);
            this.bindCurrencyWidgetEvents();
        }
    }

    getCurrencyFlag() {
        const currency = this.availableCurrencies.find(c => c.code === this.currentCurrency);
        return currency ? currency.country : '🇪🇺';
    }

    generateCurrencyList() {
        return this.availableCurrencies.map(currency => `
            <div class="currency-item" data-code="${currency.code}">
                <span class="currency-flag">${currency.country}</span>
                <span class="currency-name">${currency.name}</span>
                <span class="currency-symbol">${currency.symbol}</span>
                <span class="currency-code">${currency.code}</span>
            </div>
        `).join('');
    }

    bindCurrencyWidgetEvents() {
        const toggle = document.getElementById('currencyToggle');
        const dropdown = document.getElementById('currencyDropdown');
        const searchInput = document.getElementById('currencySearch');
        const currencyList = document.getElementById('currencyList');

        if (!toggle) return;

        // Toggle dropdown
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        // Recherche
        searchInput?.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const items = currencyList.querySelectorAll('.currency-item');
            
            items.forEach(item => {
                const name = item.querySelector('.currency-name').textContent.toLowerCase();
                const code = item.querySelector('.currency-code').textContent.toLowerCase();
                const matches = name.includes(searchTerm) || code.includes(searchTerm);
                item.style.display = matches ? 'flex' : 'none';
            });
        });

        // Sélection devise
        currencyList?.addEventListener('click', (e) => {
            const item = e.target.closest('.currency-item');
            if (item) {
                const currencyCode = item.dataset.code;
                this.setCurrency(currencyCode);
                dropdown.classList.remove('show');
                
                // Mettre à jour l'affichage
                toggle.querySelector('.currency-flag').textContent = 
                    this.availableCurrencies.find(c => c.code === currencyCode)?.country || '🇪🇺';
                toggle.querySelector('.currency-code').textContent = currencyCode;
            }
        });

        // Fermer en cliquant ailleurs
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.currency-widget')) {
                dropdown.classList.remove('show');
            }
        });
    }

    // Nouveau: Conversion pour Interac (toujours en CAD)
    convertToCAD(amount, fromCurrency = 'EUR') {
        return this.convert(amount, fromCurrency, 'CAD');
    }

    // Nouveau: Rafraîchir les taux
    async refreshRates() {
        await this.fetchExchangeRates();
        window.dispatchEvent(new CustomEvent('exchangeRatesUpdated'));
    }
}

// Initialiser et exposer
window.currencyManager = new CurrencyManager();

// CSS pour le widget
const currencyStyles = `
<style>
.currency-widget {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1000;
}

.currency-toggle {
    background: white;
    border: 2px solid #3c84f6;
    border-radius: 25px;
    padding: 8px 15px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: 600;
    color: #333;
    box-shadow: 0 4px 12px rgba(60, 132, 246, 0.2);
    transition: all 0.3s;
}

.currency-toggle:hover {
    background: #f0f7ff;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(60, 132, 246, 0.3);
}

.currency-flag {
    font-size: 1.2rem;
}

.currency-dropdown {
    position: absolute;
    bottom: 100%;
    right: 0;
    width: 300px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
    margin-bottom: 10px;
    display: none;
    overflow: hidden;
    max-height: 400px;
}

.currency-dropdown.show {
    display: block;
    animation: fadeInUp 0.3s ease;
}

@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.currency-search {
    padding: 15px;
    border-bottom: 1px solid #eee;
    position: relative;
}

.currency-search input {
    width: 100%;
    padding: 10px 15px 10px 35px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 0.95rem;
}

.currency-search i {
    position: absolute;
    left: 25px;
    top: 50%;
    transform: translateY(-50%);
    color: #666;
}

.currency-list {
    max-height: 300px;
    overflow-y: auto;
}

.currency-item {
    padding: 12px 15px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    border-bottom: 1px solid #f5f5f5;
    transition: background 0.2s;
}

.currency-item:hover {
    background: #f8f9fa;
}

.currency-item:last-child {
    border-bottom: none;
}

.currency-name {
    flex: 1;
    font-weight: 500;
}

.currency-symbol {
    color: #666;
    font-weight: 600;
    min-width: 40px;
}

.currency-code {
    color: #999;
    font-size: 0.9rem;
    font-family: monospace;
}

/* Mobile */
@media (max-width: 768px) {
    .currency-widget {
        bottom: 70px;
        right: 10px;
    }
    
    .currency-dropdown {
        width: calc(100vw - 40px);
        right: -10px;
    }
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', currencyStyles);