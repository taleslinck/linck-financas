import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wallet, PieChart as PieChartIcon, Plus, Trash2, DollarSign, TrendingUp,
  AlertCircle, Calendar, CheckCircle2, Circle, Settings2, ChevronLeft,
  ChevronRight, BarChart3, ListTodo, Edit, X, Target, Car, Home, Plane,
  Sparkles, ArrowRight, Save, BookOpen, RotateCcw, AlertTriangle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

// --- Utilitários de Data ---
const getInitialMonth = () => '2026-11';
const getInitialYear = () => 2026;

const formatMonthDisplay = (monthStr) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(year, parseInt(month) - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
};

const getMonthShortName = (monthStr) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(year, parseInt(month) - 1, 1);
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
};

const addMonths = (monthStr, amount) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(year, parseInt(month) - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthsDiff = (startStr, endStr) => {
  const [sY, sM] = startStr.split('-').map(Number);
  const [eY, eM] = endStr.split('-').map(Number);
  return (eY - sY) * 12 + (eM - sM);
};

const isItemActiveInMonth = (itemStartMonth, duration, targetMonthStr) => {
  if (!itemStartMonth || !targetMonthStr) return false;
  const diffMonths = getMonthsDiff(itemStartMonth, targetMonthStr);
  if (diffMonths < 0) return false; 
  if (duration && diffMonths >= parseInt(duration)) return false; 
  return true;
};

const getBaseIncomeForMonth = (monthStr, historyObj) => {
  const sortedMonths = Object.keys(historyObj).sort();
  let currentBase = 0;
  for (const m of sortedMonths) {
    if (m <= monthStr) {
      currentBase = historyObj[m];
    } else {
      break;
    }
  }
  return currentBase;
};

// --- Cálculos Financeiros ---
const calculatePMT = (principal, ratePerMonth, periods) => {
  if (ratePerMonth === 0) return principal / periods;
  const i = ratePerMonth / 100;
  return (principal * i) / (1 - Math.pow(1 + i, -periods));
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

// --- Configuração Principal ---
const categoriesConfig = {
  needs: { key: 'needs', title: 'Gastos Fixos', color: 'blue', hex: '#3b82f6', icon: <Wallet className="w-5 h-5" /> },
  wants: { key: 'wants', title: 'Estilo de Vida', color: 'indigo', hex: '#6366f1', icon: <PieChartIcon className="w-5 h-5" /> },
  savings: { key: 'savings', title: 'Investimentos', color: 'emerald', hex: '#10b981', icon: <TrendingUp className="w-5 h-5" /> }
};

const goalTemplates = {
  carro: { 
    icon: <Car size={24} />, name: 'Carro Novo', 
    costs: [
      { name: 'Combustível', amount: 400, categoryKey: 'needs' },
      { name: 'Seguro Auto', amount: 150, categoryKey: 'needs' },
      { name: 'IPVA (Provisão)', amount: 120, categoryKey: 'needs' },
      { name: 'Manutenção (Provisão)', amount: 100, categoryKey: 'needs' }
    ]
  },
  imovel: { 
    icon: <Home size={24} />, name: 'Imóvel / Casa', 
    costs: [
      { name: 'Condomínio', amount: 500, categoryKey: 'needs' },
      { name: 'IPTU (Provisão)', amount: 150, categoryKey: 'needs' },
      { name: 'Manutenção do Imóvel', amount: 200, categoryKey: 'needs' }
    ]
  },
  viagem: { 
    icon: <Plane size={24} />, name: 'Viagem dos Sonhos', 
    costs: [
      { name: 'Seguro Viagem', amount: 80, categoryKey: 'wants' },
      { name: 'Passeios Extras', amount: 500, categoryKey: 'wants' }
    ]
  },
  outro: { icon: <Target size={24} />, name: 'Outra Meta', costs: [] }
};

// --- Hook Customizado para LocalStorage ---
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Erro ao ler localStorage (${key}):`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Erro ao salvar localStorage (${key}):`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default function App() {
  const [activeTab, setActiveTab] = useState('mensal');
  
  // --- Estados Persistentes (LocalStorage) - Tudo Inicia Zerado ---
  const [baseIncomeHistory, setBaseIncomeHistory] = useLocalStorage('linck_baseIncome', { [getInitialMonth()]: 0 });
  const [extraIncomes, setExtraIncomes] = useLocalStorage('linck_extraIncomes', {});
  const [percentages, setPercentages] = useLocalStorage('linck_percentages', { needs: 50, wants: 30, savings: 20 });
  const [expenses, setExpenses] = useLocalStorage('linck_expenses', []); 
  const [monthData, setMonthData] = useLocalStorage('linck_monthData', {});
  const [overrides, setOverrides] = useLocalStorage('linck_overrides', {});
  const [goals, setGoals] = useLocalStorage('linck_goals', []);

  // --- Estados de Navegação Temporária ---
  const [currentMonth, setCurrentMonth] = useState(getInitialMonth());
  const [currentYear, setCurrentYear] = useState(getInitialYear());

  // --- Estados de Formulários e UI ---
  const [baseIncomeInput, setBaseIncomeInput] = useState('');
  const [extraIncomeForm, setExtraIncomeForm] = useState({ name: '', amount: '' });
  
  const initialFormState = { name: '', categoryKey: 'needs', type: 'real', amount: '', dueDate: '', duration: '', startMonth: currentMonth };
  const [newItem, setNewItem] = useState(initialFormState);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [editScope, setEditScope] = useState('all');

  // --- Estados dos Novos Modais ---
  const [showManual, setShowManual] = useState(false);
  const [resetStep, setResetStep] = useState(0); // 0: Fechado, 1: Confirmar, 2: Digitar ZERAR
  const [resetConfirmText, setResetConfirmText] = useState('');

  // --- Estados do Wizard de Metas ---
  const [showGoalWizard, setShowGoalWizard] = useState(false);
  const [goalStep, setGoalStep] = useState(1);
  const [newGoal, setNewGoal] = useState({
    type: 'carro', name: '', targetMonth: addMonths(getInitialMonth(), 12), totalValue: '', 
    downPayment: '', financingTerm: '48', interestRate: '1.5', costs: goalTemplates['carro'].costs.map(c => ({...c, id: Math.random().toString()}))
  });

  // Atualiza o input de salário ao trocar de mês
  useEffect(() => {
    setNewItem(prev => ({ ...prev, startMonth: currentMonth }));
    const base = getBaseIncomeForMonth(currentMonth, baseIncomeHistory);
    setBaseIncomeInput(base === 0 ? '' : base.toString());
  }, [currentMonth, baseIncomeHistory]);

  // --- Handlers: Reset Total ---
  const handleCompleteReset = () => {
    if (resetConfirmText === 'ZERAR') {
      localStorage.clear(); // Limpa tudo
      setBaseIncomeHistory({ [getInitialMonth()]: 0 });
      setExtraIncomes({});
      setPercentages({ needs: 50, wants: 30, savings: 20 });
      setExpenses([]);
      setMonthData({});
      setOverrides({});
      setGoals([]);
      setResetStep(0);
      setResetConfirmText('');
      setCurrentMonth(getInitialMonth());
      setCurrentYear(getInitialYear());
    }
  };

  // --- Handlers: Renda ---
  const handleBaseIncomeSubmit = (e) => {
    e.preventDefault();
    const val = parseFloat(baseIncomeInput.replace(',', '.'));
    if (!isNaN(val) && val >= 0) setBaseIncomeHistory(prev => ({ ...prev, [currentMonth]: val }));
  };

  const handleAddExtraIncome = (e) => {
    e.preventDefault();
    const amount = parseFloat(extraIncomeForm.amount.replace(',', '.'));
    if (extraIncomeForm.name.trim() === '' || isNaN(amount) || amount <= 0) return;
    setExtraIncomes(prev => ({
      ...prev, [currentMonth]: [...(prev[currentMonth] || []), { id: Date.now().toString(), name: extraIncomeForm.name, amount }]
    }));
    setExtraIncomeForm({ name: '', amount: '' });
  };

  const handleDeleteExtraIncome = (month, id) => {
    setExtraIncomes(prev => ({ ...prev, [month]: (prev[month] || []).filter(item => item.id !== id) }));
  };

  // --- Handlers: Despesas ---
  const handleAddItem = (e) => {
    e.preventDefault();
    const amount = parseFloat(newItem.amount.replace(',', '.'));
    if (newItem.name.trim() === '' || isNaN(amount) || amount <= 0) return;
    setExpenses(prev => [...prev, { 
      id: Date.now().toString(), name: newItem.name, categoryKey: newItem.categoryKey, type: newItem.type, amount,
      dueDate: newItem.dueDate ? parseInt(newItem.dueDate) : null, duration: newItem.duration ? parseInt(newItem.duration) : null,
      startMonth: newItem.startMonth
    }]);
    setNewItem({ ...initialFormState, startMonth: currentMonth });
    setShowForm(false);
  };

  const handleDeleteItem = (id) => setExpenses(prev => prev.filter(item => item.id !== id));

  const handleConfirmDeleteScope = (scope) => {
    if (!deletingItem) return;
    if (scope === 'month') {
      setOverrides(prev => ({ ...prev, [currentMonth]: { ...(prev[currentMonth] || {}), [deletingItem.id]: { isDeleted: true } } }));
    } else {
      handleDeleteItem(deletingItem.id);
    }
    setDeletingItem(null);
  };

  const handleUpdateItem = (e) => {
    e.preventDefault();
    const amount = parseFloat(editingItem.amount.toString().replace(',', '.'));
    if (editingItem.name.trim() === '' || isNaN(amount) || amount <= 0) return;

    if (editScope === 'month') {
      setOverrides(prev => ({
        ...prev, [currentMonth]: { ...(prev[currentMonth] || {}), [editingItem.id]: { ...(prev[currentMonth]?.[editingItem.id] || {}), name: editingItem.name, amount } }
      }));
    } else {
      setExpenses(prev => prev.map(item => item.id === editingItem.id ? {
        ...item, name: editingItem.name, categoryKey: editingItem.categoryKey, type: editingItem.type, amount,
        dueDate: editingItem.dueDate ? parseInt(editingItem.dueDate) : null, duration: editingItem.duration ? parseInt(editingItem.duration) : null,
        startMonth: editingItem.startMonth
      } : item));
    }
    setEditingItem(null);
  };

  const updateMonthData = (itemId, field, value) => {
    setMonthData(prev => ({
      ...prev, [currentMonth]: { ...(prev[currentMonth] || {}), [itemId]: { ...(prev[currentMonth]?.[itemId] || {}), [field]: value } }
    }));
  };

  const handlePercentageChange = (key, val) => {
    const num = parseInt(val) || 0;
    setPercentages(prev => ({ ...prev, [key]: num }));
  };

  // --- Handlers: Metas ---
  const handleGoalTypeChange = (type) => {
    setNewGoal(prev => ({ ...prev, type, costs: goalTemplates[type].costs.map(c => ({...c, id: Math.random().toString()})) }));
  };

  const handleGoalCostChange = (id, field, value) => {
    setNewGoal(prev => ({
      ...prev, costs: prev.costs.map(c => c.id === id ? { ...c, [field]: value } : c)
    }));
  };

  const handleAddGoalCost = () => {
    setNewGoal(prev => ({
      ...prev, costs: [...prev.costs, { id: Date.now().toString(), name: '', amount: '', categoryKey: 'needs' }]
    }));
  };

  const handleRemoveGoalCost = (id) => {
    setNewGoal(prev => ({ ...prev, costs: prev.costs.filter(c => c.id !== id) }));
  };

  const saveGoal = () => {
    const totalVal = parseFloat(newGoal.totalValue) || 0;
    const downP = parseFloat(newGoal.downPayment) || 0;
    const term = parseInt(newGoal.financingTerm) || 0;
    const rate = parseFloat(newGoal.interestRate) || 0;
    const pmt = calculatePMT(totalVal - downP, rate, term);
    
    const goalId = `goal-${Date.now()}`;
    const finalizedGoal = {
      id: goalId,
      ...newGoal,
      totalValue: totalVal, downPayment: downP, financingTerm: term, interestRate: rate, pmt,
      costs: newGoal.costs.map(c => ({ ...c, amount: parseFloat(c.amount) || 0 }))
    };

    setGoals(prev => [...prev, finalizedGoal]);

    const newGoalExpenses = [];
    if (term > 0 && (totalVal - downP) > 0) {
      newGoalExpenses.push({
        id: `exp-${goalId}-fin`, goalId: goalId,
        name: `Parcela - ${finalizedGoal.name}`, categoryKey: 'needs', type: 'real', amount: pmt,
        startMonth: finalizedGoal.targetMonth, duration: term, dueDate: 10
      });
    }

    finalizedGoal.costs.forEach((cost, idx) => {
      if (cost.amount > 0 && cost.name.trim() !== '') {
        newGoalExpenses.push({
          id: `exp-${goalId}-cost-${idx}`, goalId: goalId,
          name: `${cost.name} (${finalizedGoal.name})`, categoryKey: cost.categoryKey, type: 'planned', amount: cost.amount,
          startMonth: finalizedGoal.targetMonth, dueDate: 10 
        });
      }
    });

    setExpenses(prev => [...prev, ...newGoalExpenses]);
    setShowGoalWizard(false);
    setGoalStep(1);
    setNewGoal({ type: 'carro', name: '', targetMonth: addMonths(currentMonth, 12), totalValue: '', downPayment: '', financingTerm: '48', interestRate: '1.5', costs: goalTemplates['carro'].costs.map(c => ({...c, id: Math.random().toString()})) });
  };

  const handleDeleteGoal = (goalId) => {
    setGoals(prev => prev.filter(g => g.id !== goalId));
    setExpenses(prev => prev.filter(e => e.goalId !== goalId)); 
  };

  // --- Lógicas de Cálculo Global ---
  const activeBaseIncome = getBaseIncomeForMonth(currentMonth, baseIncomeHistory);
  const getExtraIncomesTotal = (monthStr) => (extraIncomes[monthStr] || []).reduce((sum, item) => sum + item.amount, 0);
  const currentMonthIncome = activeBaseIncome + getExtraIncomesTotal(currentMonth);
  const totalPercentage = percentages.needs + percentages.wants + percentages.savings;
  const isPercentageValid = totalPercentage === 100;

  const currentMonthlySavingsPower = expenses
    .filter(e => e.categoryKey === 'savings' && isItemActiveInMonth(e.startMonth, e.duration, currentMonth))
    .reduce((sum, item) => sum + item.amount, 0);

  // Aba 1: Dados do Mês Atual
  const activeItemsThisMonth = useMemo(() => {
    return expenses.filter(item => {
      if (overrides[currentMonth]?.[item.id]?.isDeleted) return false;
      return isItemActiveInMonth(item.startMonth, item.duration, currentMonth);
    }).sort((a, b) => (a.dueDate || 99) - (b.dueDate || 99));
  }, [expenses, currentMonth, overrides]);

  const monthlyDashboardData = useMemo(() => {
    const data = {};
    Object.keys(categoriesConfig).forEach(key => {
      const target = currentMonthIncome * (percentages[key] / 100);
      const categoryItems = activeItemsThisMonth.filter(i => i.categoryKey === key);
      let expectedTotal = 0, realizedTotal = 0;
      categoryItems.forEach(item => {
        const itemOverride = overrides[currentMonth]?.[item.id] || {};
        const itemMonthData = monthData[currentMonth]?.[item.id] || {};
        const effectiveAmount = itemOverride.amount !== undefined ? itemOverride.amount : item.amount;
        expectedTotal += effectiveAmount;
        realizedTotal += item.type === 'real' ? effectiveAmount : (itemMonthData.actualAmount || 0);
      });
      data[key] = {
        target, expectedTotal, realizedTotal, remainingTarget: target - realizedTotal,
        progressPercent: target > 0 ? Math.min((realizedTotal / target) * 100, 100) : 0,
        isOverBudget: (target - realizedTotal) < 0
      };
    });
    return data;
  }, [currentMonthIncome, percentages, activeItemsThisMonth, monthData, currentMonth, overrides]);

  // Aba 2: Dados do Ano
  const yearlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => `${currentYear}-${String(i + 1).padStart(2, '0')}`);
    let totalYearlyIncome = 0, totalYearlyPlanned = 0, totalYearlyRealized = 0;
    const categoryTotals = {
      needs: { planned: 0, realized: 0, target: 0 }, wants: { planned: 0, realized: 0, target: 0 }, savings: { planned: 0, realized: 0, target: 0 }
    };

    const monthlyChartData = months.map(monthStr => {
      const mIncome = getBaseIncomeForMonth(monthStr, baseIncomeHistory) + getExtraIncomesTotal(monthStr);
      totalYearlyIncome += mIncome;
      categoryTotals.needs.target += mIncome * (percentages.needs / 100);
      categoryTotals.wants.target += mIncome * (percentages.wants / 100);
      categoryTotals.savings.target += mIncome * (percentages.savings / 100);

      const activeInMonth = expenses.filter(item => !overrides[monthStr]?.[item.id]?.isDeleted && isItemActiveInMonth(item.startMonth, item.duration, monthStr));
      let mPlanned = 0, mRealized = 0;

      activeInMonth.forEach(item => {
        const effectiveAmount = overrides[monthStr]?.[item.id]?.amount !== undefined ? overrides[monthStr][item.id].amount : item.amount;
        mPlanned += effectiveAmount;
        let itemRealized = item.type === 'real' ? effectiveAmount : (monthData[monthStr]?.[item.id]?.actualAmount || 0);
        mRealized += itemRealized;
        categoryTotals[item.categoryKey].planned += effectiveAmount;
        categoryTotals[item.categoryKey].realized += itemRealized;
      });

      totalYearlyPlanned += mPlanned;
      totalYearlyRealized += mRealized;
      return { name: getMonthShortName(monthStr).substring(0, 3).toUpperCase(), Planejado: mPlanned, Realizado: mRealized, Renda: mIncome };
    });

    const pieChartData = [
      { name: 'Fixos', value: categoryTotals.needs.realized, fill: categoriesConfig.needs.hex },
      { name: 'Vida', value: categoryTotals.wants.realized, fill: categoriesConfig.wants.hex },
      { name: 'Inv.', value: categoryTotals.savings.realized, fill: categoriesConfig.savings.hex }
    ].filter(d => d.value > 0);

    return { monthlyChartData, pieChartData, totalYearlyPlanned, totalYearlyRealized, categoryTotals, totalYearlyIncome };
  }, [currentYear, expenses, monthData, baseIncomeHistory, extraIncomes, percentages, overrides]);

  const getColorClasses = (colorName, type) => {
    const colors = {
      blue: { bg: 'bg-blue-500', text: 'text-blue-700', lightBg: 'bg-blue-50' },
      indigo: { bg: 'bg-indigo-500', text: 'text-indigo-700', lightBg: 'bg-indigo-50' },
      emerald: { bg: 'bg-emerald-500', text: 'text-emerald-700', lightBg: 'bg-emerald-50' },
      red: { bg: 'bg-rose-500', text: 'text-rose-700', lightBg: 'bg-rose-50' }
    };
    return colors[colorName]?.[type] || '';
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      
      {/* HEADER & TABS */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between py-3 gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-600 p-2 rounded-xl shadow-sm">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Linck <span className="text-emerald-600">Finanças</span></h1>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
              <button onClick={() => setActiveTab('mensal')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'mensal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <ListTodo size={18} /> Mensal
              </button>
              <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <BarChart3 size={18} /> Anual
              </button>
              <button onClick={() => setActiveTab('metas')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'metas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Target size={18} /> Metas (Futuro)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setShowManual(true)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                <BookOpen size={16} /> <span className="hidden sm:inline">Manual</span>
              </button>
              <button onClick={() => setResetStep(1)} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors">
                <RotateCcw size={16} /> <span className="hidden sm:inline">Zerar Dados</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        
        {/* ABA 1: PLANEJAMENTO MENSAL */}
        {activeTab === 'mensal' && (
          <div className="animate-in fade-in duration-500 space-y-8">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col lg:flex-row gap-8">
              {/* Controle de Mês e Renda */}
              <div className="flex-1 lg:border-r border-slate-200 lg:pr-8 flex flex-col gap-6">
                <div className="flex items-center justify-between bg-slate-100 rounded-xl p-1.5 border border-slate-200 shadow-inner w-full max-w-sm mx-auto lg:mx-0">
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-2 rounded-lg hover:bg-white transition-all text-slate-600"><ChevronLeft size={20} /></button>
                  <div className="flex-1 text-center font-bold text-slate-800 capitalize text-sm sm:text-base">{formatMonthDisplay(currentMonth)}</div>
                  <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-white transition-all text-slate-600"><ChevronRight size={20} /></button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 mb-1 flex justify-between">
                      Salário Base
                      {baseIncomeHistory[currentMonth] !== undefined && baseIncomeHistory[currentMonth] > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">ATUALIZADO AQUI</span>}
                    </h2>
                    <form onSubmit={handleBaseIncomeSubmit} className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm">R$</span>
                        <input type="number" step="0.01" min="0" placeholder="0,00" value={baseIncomeInput} onChange={(e) => setBaseIncomeInput(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-emerald-500" />
                      </div>
                      <button type="submit" className="px-4 py-2 text-sm font-medium rounded-xl text-white bg-slate-800 hover:bg-slate-900">Salvar Base</button>
                    </form>
                    {activeBaseIncome === 0 && <p className="text-xs text-rose-500 mt-1">Defina sua renda base para começar o planejamento.</p>}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <h2 className="text-sm font-semibold text-slate-900 mb-1 flex justify-between">
                      Rendas Extras
                      {(extraIncomes[currentMonth]?.length > 0) && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">ATIVA</span>}
                    </h2>
                    <form onSubmit={handleAddExtraIncome} className="flex gap-2 mb-3">
                      <input type="text" placeholder="Ex: 13º Salário..." value={extraIncomeForm.name} onChange={(e) => setExtraIncomeForm({...extraIncomeForm, name: e.target.value})} className="flex-1 px-3 py-2 text-sm border rounded-xl" />
                      <div className="relative w-28"><span className="absolute inset-y-0 left-2 flex items-center text-slate-500 text-sm">R$</span>
                        <input type="number" step="0.01" min="0" value={extraIncomeForm.amount} onChange={(e) => setExtraIncomeForm({...extraIncomeForm, amount: e.target.value})} className="w-full pl-7 pr-2 py-2 text-sm border rounded-xl" />
                      </div>
                      <button type="submit" className="p-2 rounded-xl bg-slate-800 text-white"><Plus size={20} /></button>
                    </form>
                    {extraIncomes[currentMonth]?.map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-emerald-50 p-2.5 rounded-xl text-sm mb-2">
                        <span className="text-emerald-900">{item.name}</span>
                        <div className="flex gap-3"><span className="text-emerald-700 font-bold">{formatCurrency(item.amount)}</span>
                        <button onClick={() => handleDeleteExtraIncome(currentMonth, item.id)} className="text-emerald-600"><Trash2 size={16}/></button></div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-700 flex items-center justify-between">
                      <span className="font-semibold">Renda Total do Mês:</span> 
                      <span className="font-bold text-emerald-600 text-lg">{formatCurrency(currentMonthIncome)}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Porcentagens */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <Settings2 className="w-5 h-5 text-slate-700" />
                  <h2 className="text-sm font-semibold text-slate-900">Regra de Distribuição (%)</h2>
                </div>
                <div className="space-y-3">
                  {Object.values(categoriesConfig).map(cat => (
                    <div key={cat.key} className="flex items-center gap-3">
                      <label className="text-sm font-medium text-slate-700 w-28 truncate">{cat.title}</label>
                      <input type="range" min="0" max="100" value={percentages[cat.key]} onChange={(e) => handlePercentageChange(cat.key, e.target.value)} className="flex-1 h-2 bg-slate-200 rounded-lg accent-emerald-600" />
                      <div className="relative w-16">
                        <input type="number" min="0" max="100" value={percentages[cat.key]} onChange={(e) => handlePercentageChange(cat.key, e.target.value)} className="w-full pr-5 py-1 text-center border rounded-lg text-sm" />
                        <span className="absolute inset-y-0 right-2 flex items-center text-slate-400 text-xs">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                {!isPercentageValid && (
                  <div className="mt-3 p-2 bg-amber-50 rounded-lg flex gap-2 border border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                    <p className="text-xs text-amber-800">Soma atual é <strong>{totalPercentage}%</strong>. Ajuste para fechar 100%.</p>
                  </div>
                )}
              </div>
            </section>

            {currentMonthIncome > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-slate-900">Visão Geral do Orçamento</h2>
                  <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-medium">
                    {showForm ? 'Cancelar' : <><Plus size={18} /> Novo Lançamento</>}
                  </button>
                </div>

                {/* Formulário de Novo Gasto */}
                {showForm && (
                  <form onSubmit={handleAddItem} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-in slide-in-from-top-4">
                    <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-3">Detalhes do Gasto/Investimento</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label><input type="text" required placeholder="Ex: Conta de Luz, Aluguel..." value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-emerald-500" /></div>
                      <div><label className="block text-xs font-medium text-slate-500 mb-1">Regra (Categoria)</label><select value={newItem.categoryKey} onChange={(e) => setNewItem({...newItem, categoryKey: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg bg-white outline-none">{Object.values(categoriesConfig).map(c => <option key={c.key} value={c.key}>{c.title}</option>)}</select></div>
                      <div><label className="block text-xs font-medium text-slate-500 mb-1">Valor Planejado (R$)</label><input type="number" step="0.01" min="0" required value={newItem.amount} onChange={(e) => setNewItem({...newItem, amount: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg outline-none" /></div>
                      <div><label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label><select value={newItem.type} onChange={(e) => setNewItem({...newItem, type: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg bg-white outline-none"><option value="real">Fixo / Real</option><option value="planned">Previsão (Variável)</option></select></div>
                      <div><label className="block text-xs font-medium text-slate-500 mb-1">Mês Início</label><input type="month" required value={newItem.startMonth} onChange={(e) => setNewItem({...newItem, startMonth: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg outline-none" /></div>
                      <div><label className="block text-xs font-medium text-slate-500 mb-1">Duração (Meses)</label><input type="number" min="1" placeholder="Vazio = contínuo" value={newItem.duration} onChange={(e) => setNewItem({...newItem, duration: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg outline-none" /></div>
                      <div><label className="block text-xs font-medium text-slate-500 mb-1">Vencimento (Dia)</label><input type="number" min="1" max="31" placeholder="Opcional" value={newItem.dueDate} onChange={(e) => setNewItem({...newItem, dueDate: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg outline-none" /></div>
                    </div>
                    <div className="flex justify-end"><button type="submit" className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm">Adicionar à Lista</button></div>
                  </form>
                )}

                {/* Cards 50/30/20 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.values(categoriesConfig).map((category) => {
                    const data = monthlyDashboardData[category.key];
                    const activeColor = data.isOverBudget ? 'red' : category.color;
                    return (
                      <div key={category.key} className="bg-white rounded-2xl shadow-sm border p-5 flex flex-col relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full ${getColorClasses(activeColor, 'bg')}`}></div>
                        <div className="flex items-center gap-3 mb-5 pl-2">
                          <div className={`p-2.5 rounded-xl ${getColorClasses(category.color, 'lightBg')} ${getColorClasses(category.color, 'text')}`}>{category.icon}</div>
                          <div><h3 className="font-bold">{category.title}</h3><p className="text-xs text-slate-500">Meta: {percentages[category.key]}%</p></div>
                        </div>
                        <div className="space-y-4 mt-auto pl-2">
                          <div className="flex justify-between items-end"><span className="text-sm">Teto</span><span className="font-bold text-lg">{formatCurrency(data.target)}</span></div>
                          <div className="bg-slate-50 p-3 rounded-lg border text-sm space-y-1">
                            <div className="flex justify-between"><span className="text-slate-500">Planejado:</span><span className="font-medium">{formatCurrency(data.expectedTotal)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">Realizado:</span><span className="font-bold text-slate-900">{formatCurrency(data.realizedTotal)}</span></div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs font-medium mb-1"><span className="text-slate-500">Uso do Teto</span><span className={data.isOverBudget ? 'text-rose-600' : 'text-slate-700'}>{data.progressPercent.toFixed(0)}%</span></div>
                            <div className="w-full bg-slate-100 rounded-full h-2"><div className={`h-full rounded-full transition-all duration-500 ${getColorClasses(activeColor, 'bg')}`} style={{ width: `${data.progressPercent}%` }}></div></div>
                          </div>
                          <div className="flex justify-between pt-2 border-t"><span className="text-sm font-medium">Saldo Livre:</span><span className={`font-bold flex gap-1 items-center ${data.isOverBudget ? 'text-rose-600' : 'text-emerald-600'}`}>{data.isOverBudget && <AlertCircle size={16}/>}{formatCurrency(data.remainingTarget)}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Checklist Mensal */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                  <div className="p-5 border-b bg-slate-50 flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-bold flex gap-2"><CheckCircle2 className="text-emerald-500"/> Checklist do Mês</h2>
                      <p className="text-sm text-slate-500">Marque o que pagou e preencha valores reais nas previsões.</p>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {activeItemsThisMonth.length === 0 ? <div className="p-10 text-center text-slate-400">Nenhum lançamento planejado para este mês. Adicione no botão acima.</div> : 
                      activeItemsThisMonth.map(item => {
                        const isPaid = monthData[currentMonth]?.[item.id]?.paid || false;
                        const catConfig = categoriesConfig[item.categoryKey];
                        const effName = overrides[currentMonth]?.[item.id]?.name || item.name;
                        const effAmt = overrides[currentMonth]?.[item.id]?.amount !== undefined ? overrides[currentMonth][item.id].amount : item.amount;
                        
                        return (
                          <div key={item.id} className={`flex flex-col lg:flex-row lg:items-center justify-between p-4 hover:bg-slate-50 gap-4 ${isPaid ? 'bg-slate-50/60 opacity-80' : ''}`}>
                            <div className="flex items-start lg:items-center gap-4">
                              <button onClick={() => updateMonthData(item.id, 'paid', !isPaid)} className={`mt-1 lg:mt-0 ${isPaid ? 'text-emerald-500' : 'text-slate-300'}`}>{isPaid ? <CheckCircle2 size={26}/> : <Circle size={26}/>}</button>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`font-semibold ${isPaid ? 'line-through text-slate-500' : 'text-slate-800'}`}>{effName}</span>
                                  {item.goalId && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 rounded-full border border-blue-200 flex items-center gap-1"><Sparkles size={10}/> META</span>}
                                  {overrides[currentMonth]?.[item.id]?.amount !== undefined && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 rounded-full">EDITADO NO MÊS</span>}
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                  {item.dueDate && <span className="bg-slate-100 px-1.5 py-0.5 rounded border"><Calendar size={12} className="inline mr-1"/>Dia {item.dueDate}</span>}
                                  <span className="px-1.5 py-0.5 rounded border">{item.type === 'real' ? 'Fixo' : 'Previsão'}</span>
                                  <span className={`uppercase font-bold ${getColorClasses(catConfig.color, 'text')}`}>{catConfig.title}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-6 w-full lg:w-auto">
                              {item.type === 'real' ? (
                                <div className="text-right w-24"><span className="block text-xs text-slate-400">Valor</span><span className="font-bold">{formatCurrency(effAmt)}</span></div>
                              ) : (
                                <div className="flex items-center gap-4 bg-indigo-50 p-2 rounded-xl border border-indigo-100">
                                  <div className="text-right hidden sm:block"><span className="block text-[10px] text-indigo-500 font-bold uppercase">Previsto</span><span className="text-sm line-through text-slate-500">{formatCurrency(effAmt)}</span></div>
                                  <div className="flex flex-col"><label className="text-[10px] text-indigo-700 font-bold uppercase mb-1">Realizado</label>
                                    <div className="relative w-28"><span className="absolute inset-y-0 left-2 flex items-center text-slate-500 text-sm">R$</span>
                                    <input type="number" step="0.01" min="0" value={monthData[currentMonth]?.[item.id]?.actualAmount || ''} onChange={(e) => updateMonthData(item.id, 'actualAmount', e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full pl-7 pr-2 py-1 text-sm font-bold border rounded outline-none" /></div>
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-1">
                                <button onClick={() => { setEditScope('all'); setEditingItem({ ...item, name: effName, amount: effAmt }); }} className="text-slate-300 hover:text-blue-500 p-2"><Edit size={20}/></button>
                                <button onClick={() => setDeletingItem(item)} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={20}/></button>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    }
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ABA 2: DASHBOARD ANUAL */}
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="flex justify-between items-center">
              <div><h2 className="text-2xl font-bold">Visão Anual</h2><p className="text-sm text-slate-500">Fluxo de caixa em {currentYear}</p></div>
              <div className="flex items-center bg-white rounded-xl p-1.5 border shadow-sm">
                <button onClick={() => setCurrentYear(prev => prev - 1)} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={20} /></button>
                <div className="w-24 text-center font-bold text-lg">{currentYear}</div>
                <button onClick={() => setCurrentYear(prev => prev + 1)} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={20} /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-sm text-slate-500">Renda Total</p><p className="text-2xl font-bold">{formatCurrency(yearlyData.totalYearlyIncome)}</p></div>
              <div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-sm text-slate-500">Total Planejado</p><p className="text-2xl font-bold text-indigo-600">{formatCurrency(yearlyData.totalYearlyPlanned)}</p></div>
              <div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-sm text-slate-500">Total Realizado</p><p className="text-2xl font-bold">{formatCurrency(yearlyData.totalYearlyRealized)}</p></div>
              <div className="bg-white p-5 rounded-2xl border shadow-sm"><p className="text-sm text-slate-500">Saldo Líquido</p><p className={`text-2xl font-bold ${yearlyData.totalYearlyIncome >= yearlyData.totalYearlyRealized ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(yearlyData.totalYearlyIncome - yearlyData.totalYearlyRealized)}</p></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border shadow-sm lg:col-span-2">
                <h3 className="font-bold mb-6">Planejado vs Realizado (Mês a Mês)</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlyData.monthlyChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `R$${value/1000}k`} />
                      <RechartsTooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="Planejado" fill="#cbd5e1" radius={[4,4,0,0]} />
                      <Bar dataKey="Realizado" fill="#0f172a" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col">
                <h3 className="font-bold mb-6">Distribuição Real ({currentYear})</h3>
                <div className="flex-1 min-h-[200px] relative">
                  {yearlyData.totalYearlyRealized > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={yearlyData.pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{yearlyData.pieChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Pie><RechartsTooltip formatter={(val) => formatCurrency(val)}/></PieChart>
                    </ResponsiveContainer>
                  ) : <div className="flex h-full items-center justify-center text-slate-400">Sem gastos lançados neste ano.</div>}
                  {yearlyData.totalYearlyRealized > 0 && <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><span className="text-sm font-bold">{formatCurrency(yearlyData.totalYearlyRealized)}</span></div>}
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <h3 className="font-bold mb-6">Evolução da Renda</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyData.monthlyChartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} dy={10}/><YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `R$${val/1000}k`}/><RechartsTooltip formatter={(val) => formatCurrency(val)}/><Line type="monotone" dataKey="Renda" stroke="#10b981" strokeWidth={4}/></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ABA 3: METAS (FUTURO) */}
        {activeTab === 'metas' && (
          <div className="animate-in fade-in duration-500 space-y-6">
            <div className="flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-3xl text-white shadow-lg overflow-hidden relative">
              <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-2 flex items-center gap-2"><Sparkles className="text-emerald-400"/> Metas para o Futuro</h2>
                <p className="text-slate-300 max-w-lg mb-6">Simule grandes aquisições. O sistema projeta seu poder de investimento e injeta automaticamente custos (como IPVA ou Seguros) no seu orçamento futuro.</p>
                <button onClick={() => setShowGoalWizard(true)} className="bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2">
                  <Plus size={20} /> Criar Nova Meta
                </button>
              </div>
              <Target size={180} className="absolute right-0 top-0 opacity-10 text-emerald-300 transform translate-x-8 -translate-y-8" />
            </div>

            {goals.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
                <Target size={48} className="mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-700">Nenhuma meta ativa</h3>
                <p className="text-slate-500">Crie sua primeira meta para simular o impacto no seu orçamento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {goals.map(goal => {
                  const Icon = goalTemplates[goal.type]?.icon || <Target />;
                  const isFinanced = goal.financingTerm > 0 && goal.pmt > 0;
                  const monthsLeft = getMonthsDiff(currentMonth, goal.targetMonth);
                  
                  return (
                    <div key={goal.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-emerald-100 text-emerald-700 p-3 rounded-2xl">{Icon}</div>
                        <button onClick={() => handleDeleteGoal(goal.id)} className="text-slate-300 hover:text-rose-500 p-2"><Trash2 size={18}/></button>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">{goal.name}</h3>
                      <p className="text-sm font-medium text-slate-500 mb-4">Data Alvo: {formatMonthDisplay(goal.targetMonth)} ({monthsLeft > 0 ? `Faltam ${monthsLeft} meses` : 'Chegou!'})</p>
                      
                      <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-auto mb-4">
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Valor Total:</span><span className="font-bold">{formatCurrency(goal.totalValue)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Entrada:</span><span className="font-bold text-emerald-600">{formatCurrency(goal.downPayment)}</span></div>
                        {isFinanced && <div className="flex justify-between text-sm border-t border-slate-200 pt-2"><span className="text-slate-500">Parcela Estimada:</span><span className="font-bold text-rose-600">{goal.financingTerm}x {formatCurrency(goal.pmt)}</span></div>}
                      </div>
                      
                      {goal.costs.length > 0 && (
                        <div className="border-t border-slate-100 pt-4">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Custos Injetados no Futuro</p>
                          <div className="space-y-1">
                            {goal.costs.map((c, i) => <div key={i} className="flex justify-between text-xs text-slate-600"><span>{c.name}</span><span className="font-medium">{formatCurrency(c.amount)}</span></div>)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODAIS GLOBAIS DE INTERFACE */}
        
        {/* Modal: Manual de Uso */}
        {showManual && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 bg-slate-50 border-b flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><BookOpen className="text-blue-600"/> Guia e Dicas - Linck Finanças</h3>
                <button onClick={() => setShowManual(false)} className="text-slate-400 hover:text-rose-500"><X size={24}/></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-8 text-slate-700">
                
                <section>
                  <h4 className="font-bold text-lg text-slate-900 mb-2">Como usar o aplicativo</h4>
                  <ul className="list-disc pl-5 space-y-2 text-sm">
                    <li><strong>Renda Base:</strong> Defina o seu salário fixo. Se você for promovido, navegue até o mês da promoção e mude lá. O sistema manterá o seu passado intacto.</li>
                    <li><strong>Renda Extra:</strong> Use para o 13º, Férias ou Freelances, pois o valor soma apenas no mês selecionado.</li>
                    <li><strong>Lançamentos (Fixo vs Previsão):</strong> Contas Fixas já são contabilizadas automaticamente no valor exato. Previsões (como Supermercado ou Lazer) exigem que você digite o "Realizado" no checklist do mês quando o dinheiro de fato for gasto.</li>
                    <li><strong>Exceções no Mês (Overrides):</strong> Ao editar ou excluir um gasto na lixeira, o app perguntará se você quer afetar "Todos os meses" (mudar a base) ou "Apenas este mês" (para contas de luz que vieram mais caras em um mês específico).</li>
                  </ul>
                </section>

                <section className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl">
                  <h4 className="font-bold text-lg text-emerald-900 mb-3 flex items-center gap-2"><TrendingUp size={20}/> Dicas Financeiras Conscientes</h4>
                  <div className="space-y-4 text-sm text-emerald-800">
                    <p><strong>A Regra 50/30/20:</strong> Criada pela Senadora Elizabeth Warren. Sugere que 50% da sua renda pague necessidades absolutas (moradia, comida, contas base), 30% vá para o seu estilo de vida (lazer, compras) e 20% construa o seu futuro (investimentos e reserva).</p>
                    <p><strong>Pague-se Primeiro:</strong> Assim que o salário cair, faça o aporte dos 20% de Investimentos no dia 1º, antes mesmo de pagar as contas ou sair para jantar. Encare os 20% como um boleto essencial do seu futuro.</p>
                    <p><strong>Cuidado com Custos Invisíveis:</strong> Antes de comprar um carro ou casa na aba Metas, observe como os "Custos Associados" (IPVA, Gasolina, IPTU) inflam os seus Gastos Fixos. Muitas vezes, a parcela cabe no bolso, mas os custos invisíveis arruínam o limite dos 50%.</p>
                  </div>
                </section>
              </div>
              <div className="p-4 border-t bg-slate-50 text-right"><button onClick={() => setShowManual(false)} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-medium text-sm">Entendi</button></div>
            </div>
          </div>
        )}

        {/* Modal: Confirmação 1 (Reset) */}
        {resetStep === 1 && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden p-6 text-center animate-in zoom-in-95">
              <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Apagar todos os dados?</h3>
              <p className="text-slate-500 text-sm mb-6">Isso removerá todas as transações, rendas e configurações salvas no seu navegador. Deseja prosseguir?</p>
              <div className="flex gap-3">
                <button onClick={() => setResetStep(0)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200">Cancelar</button>
                <button onClick={() => setResetStep(2)} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700">Sim, Continuar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Confirmação 2 (Segurança Dupla) */}
        {resetStep === 2 && (
          <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[70] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden p-6 animate-in slide-in-from-bottom-8">
              <h3 className="text-lg font-bold text-rose-600 mb-2">Ação Irreversível</h3>
              <p className="text-slate-600 text-sm mb-4">Para confirmar a exclusão completa, digite a palavra <strong>ZERAR</strong> abaixo:</p>
              <input type="text" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())} placeholder="ZERAR" className="w-full text-center font-bold tracking-widest p-3 border-2 border-rose-200 rounded-xl mb-6 outline-none focus:border-rose-500" />
              <div className="flex gap-3">
                <button onClick={() => { setResetStep(0); setResetConfirmText(''); }} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl">Cancelar</button>
                <button onClick={handleCompleteReset} disabled={resetConfirmText !== 'ZERAR'} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl disabled:opacity-50">Apagar Definitivamente</button>
              </div>
            </div>
          </div>
        )}

        {/* Wizard de Metas, Edição e Exclusão de Itens (Mesmo comportamento anterior) */}
        {showGoalWizard && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
              
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Simulador de Metas</h3>
                  <p className="text-sm text-slate-500">Passo {goalStep} de 3</p>
                </div>
                <button onClick={() => setShowGoalWizard(false)} className="text-slate-400 hover:text-rose-500 bg-white p-2 rounded-full shadow-sm"><X size={20} /></button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {goalStep === 1 && (
                  <div className="space-y-6 animate-in slide-in-from-right-8">
                    <h4 className="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2">1. O que você quer conquistar?</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {Object.keys(goalTemplates).map(typeKey => (
                        <button key={typeKey} onClick={() => handleGoalTypeChange(typeKey)} className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${newGoal.type === typeKey ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                          {goalTemplates[typeKey].icon}
                          <span className="text-xs font-bold">{goalTemplates[typeKey].name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Nome da Meta</label><input type="text" placeholder="Ex: Creta 2024, Viagem para Europa..." required value={newGoal.name} onChange={(e) => setNewGoal({...newGoal, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Mês/Ano Alvo</label><input type="month" required min={currentMonth} value={newGoal.targetMonth} onChange={(e) => setNewGoal({...newGoal, targetMonth: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Valor Total Estimado (R$)</label><input type="number" step="0.01" min="0" required placeholder="0,00" value={newGoal.totalValue} onChange={(e) => setNewGoal({...newGoal, totalValue: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500" /></div>
                    </div>
                  </div>
                )}

                {goalStep === 2 && (
                  <div className="space-y-6 animate-in slide-in-from-right-8">
                    <h4 className="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2">2. Simulação Financeira</h4>
                    
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-medium text-emerald-800">Projeção de Investimentos</p>
                          <p className="text-xs text-emerald-600">Baseado no seu ritmo atual ({formatCurrency(currentMonthlySavingsPower)}/mês) até {formatMonthDisplay(newGoal.targetMonth)}.</p>
                        </div>
                        <Sparkles className="text-emerald-500" />
                      </div>
                      <p className="text-3xl font-bold text-emerald-900">{formatCurrency(currentMonthlySavingsPower * Math.max(getMonthsDiff(currentMonth, newGoal.targetMonth), 0))}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1">Valor de Entrada (R$)</label><input type="number" step="0.01" min="0" value={newGoal.downPayment} onChange={(e) => setNewGoal({...newGoal, downPayment: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-emerald-700 font-bold focus:ring-2 focus:ring-emerald-500" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Prazo de Financiamento (Meses)</label><input type="number" min="0" value={newGoal.financingTerm} onChange={(e) => setNewGoal({...newGoal, financingTerm: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" /></div>
                      <div><label className="block text-sm font-medium text-slate-700 mb-1">Taxa de Juros (a.m. %)</label><input type="number" step="0.01" min="0" value={newGoal.interestRate} onChange={(e) => setNewGoal({...newGoal, interestRate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" /></div>
                    </div>

                    {((parseFloat(newGoal.totalValue) || 0) - (parseFloat(newGoal.downPayment) || 0) > 0) && (parseFloat(newGoal.financingTerm) > 0) && (
                      <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-center justify-between">
                        <div>
                          <p className="text-slate-400 text-sm">Parcela Mensal Estimada (PMT)</p>
                          <p className="text-2xl font-bold">{formatCurrency(calculatePMT(parseFloat(newGoal.totalValue) - (parseFloat(newGoal.downPayment) || 0), parseFloat(newGoal.interestRate) || 0, parseInt(newGoal.financingTerm)))}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400 text-xs">Valor Financiado</p>
                          <p className="font-semibold text-sm">{formatCurrency(parseFloat(newGoal.totalValue) - (parseFloat(newGoal.downPayment) || 0))}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {goalStep === 3 && (
                  <div className="space-y-6 animate-in slide-in-from-right-8">
                    <h4 className="font-bold text-slate-800 text-lg border-b border-slate-100 pb-2 flex justify-between items-center">
                      3. Custos Associados Mensais
                      <button onClick={handleAddGoalCost} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold flex items-center gap-1 hover:bg-emerald-200"><Plus size={14}/> Adicionar</button>
                    </h4>
                    <p className="text-sm text-slate-500">Ao salvar, esses gastos serão injetados automaticamente no seu planejamento a partir do mês alvo.</p>
                    
                    <div className="space-y-3">
                      {newGoal.costs.map((cost) => (
                        <div key={cost.id} className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 relative group">
                          <input type="text" placeholder="Nome (Ex: Seguro)" value={cost.name} onChange={(e) => handleGoalCostChange(cost.id, 'name', e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-emerald-500" />
                          <input type="number" step="0.01" placeholder="Valor Mensal" value={cost.amount} onChange={(e) => handleGoalCostChange(cost.id, 'amount', e.target.value)} className="w-full sm:w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none font-medium focus:border-emerald-500" />
                          <select value={cost.categoryKey} onChange={(e) => handleGoalCostChange(cost.id, 'categoryKey', e.target.value)} className="w-full sm:w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none">
                            <option value="needs">Fixos</option><option value="wants">Estilo de Vida</option>
                          </select>
                          <button onClick={() => handleRemoveGoalCost(cost.id)} className="absolute -top-2 -right-2 bg-rose-100 text-rose-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                        </div>
                      ))}
                      {newGoal.costs.length === 0 && <p className="text-center text-slate-400 py-4">Nenhum custo associado.</p>}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center">
                {goalStep > 1 ? (
                  <button onClick={() => setGoalStep(prev => prev - 1)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-sm transition-colors">Voltar</button>
                ) : <div></div>}
                
                {goalStep < 3 ? (
                  <button disabled={!newGoal.name || !newGoal.totalValue} onClick={() => setGoalStep(prev => prev + 1)} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-medium text-sm hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50">Próximo Passo <ArrowRight size={16}/></button>
                ) : (
                  <button onClick={saveGoal} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"><Save size={16}/> Salvar e Injetar Metas</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edição */}
        {editingItem && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
              <div className="flex justify-between items-center p-5 border-b bg-slate-50"><h3 className="font-bold text-lg text-slate-800">Editar Lançamento</h3><button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-rose-500"><X size={24} /></button></div>
              <form onSubmit={handleUpdateItem} className="p-5 md:p-6 space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border mb-4">
                  <p className="text-sm font-semibold mb-2">Escopo da alteração:</p>
                  <div className="flex gap-3">
                    <label className={`flex gap-2 p-3 rounded-lg border cursor-pointer flex-1 ${editScope === 'all' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white'}`}><input type="radio" checked={editScope === 'all'} onChange={() => setEditScope('all')} className="w-4 h-4 text-blue-600" /><span className="text-sm font-medium">Todos os meses</span></label>
                    <label className={`flex gap-2 p-3 rounded-lg border cursor-pointer flex-1 ${editScope === 'month' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white'}`}><input type="radio" checked={editScope === 'month'} onChange={() => setEditScope('month')} className="w-4 h-4 text-blue-600" /><span className="text-sm font-medium">Apenas neste mês</span></label>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="col-span-2"><label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label><input type="text" required value={editingItem.name} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label><select value={editingItem.categoryKey} onChange={(e) => setEditingItem({...editingItem, categoryKey: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg bg-white outline-none">{Object.values(categoriesConfig).map(c => <option key={c.key} value={c.key}>{c.title}</option>)}</select></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Valor (R$)</label><input type="number" step="0.01" min="0" required value={editingItem.amount} onChange={(e) => setEditingItem({...editingItem, amount: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label><select value={editingItem.type} onChange={(e) => setEditingItem({...editingItem, type: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg bg-white outline-none"><option value="real">Fixo</option><option value="planned">Previsão</option></select></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Mês Início</label><input type="month" required value={editingItem.startMonth} onChange={(e) => setEditingItem({...editingItem, startMonth: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Duração</label><input type="number" min="1" value={editingItem.duration || ''} onChange={(e) => setEditingItem({...editingItem, duration: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg outline-none" /></div>
                  <div><label className="block text-xs font-medium text-slate-500 mb-1">Vencimento</label><input type="number" min="1" max="31" value={editingItem.dueDate || ''} onChange={(e) => setEditingItem({...editingItem, dueDate: e.target.value})} className="w-full px-3 py-2 text-sm border rounded-lg outline-none" /></div>
                </div>
                <div className="flex justify-end pt-6 gap-3"><button type="button" onClick={() => setEditingItem(null)} className="px-6 py-2 bg-slate-100 rounded-lg text-sm font-medium">Cancelar</button><button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Salvar</button></div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Exclusão */}
        {deletingItem && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95">
              <div className="flex justify-between items-center p-5 border-b bg-rose-50"><h3 className="font-bold text-lg text-rose-800 flex gap-2"><AlertCircle/> Excluir</h3><button onClick={() => setDeletingItem(null)} className="text-slate-400 hover:text-rose-600"><X/></button></div>
              <div className="p-6">
                <p className="text-slate-700 text-sm mb-6">Como deseja excluir <strong>{deletingItem.name}</strong>?</p>
                <div className="space-y-3">
                  <button onClick={() => handleConfirmDeleteScope('month')} className="w-full flex justify-between p-4 rounded-xl border hover:bg-rose-50 text-left"><div><h4 className="font-bold">Pular este mês</h4><p className="text-xs text-slate-500 mt-0.5">Exclui apenas de {formatMonthDisplay(currentMonth)}.</p></div><Trash2 className="text-slate-300" /></button>
                  <button onClick={() => handleConfirmDeleteScope('all')} className="w-full flex justify-between p-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-left"><div><h4 className="font-bold text-rose-800">Excluir de todos</h4><p className="text-xs text-rose-600 mt-0.5">Remove do histórico e futuro.</p></div><Trash2 className="text-rose-600" /></button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}