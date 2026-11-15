import { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, TrendingUp, PieChart } from 'lucide-react';
import { expenseAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Expenses({ eventId, socket, isOrganizer }) {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ total: 0, count: 0, byCategory: {}, remaining: 0 });
  const [budget, setBudget] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [newBudget, setNewBudget] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: '',
    paidBy: '',
    notes: ''
  });

  useEffect(() => {
    loadExpenses();

    if (socket) {
      socket.on('expenses_updated', ({ expenses: newExpenses, summary: newSummary }) => {
        setExpenses(newExpenses);
        setSummary(newSummary);
      });
    }

    return () => {
      if (socket) socket.off('expenses_updated');
    };
  }, [eventId, socket]);

  const loadExpenses = async () => {
    try {
      const res = await expenseAPI.getAll(eventId);
      setExpenses(res.data.expenses);
      setSummary(res.data.summary);
      setBudget(res.data.budget);
      setNewBudget(res.data.budget.toString());
    } catch (error) {
      console.error('Failed to load expenses:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await expenseAPI.create(eventId, {
        ...formData,
        amount: parseFloat(formData.amount)
      });
      setFormData({ title: '', amount: '', category: '', paidBy: '', notes: '' });
      setShowForm(false);
      toast.success('Expense added');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add expense');
    }
  };

  const handleBudgetUpdate = async (e) => {
    e.preventDefault();
    try {
      await expenseAPI.updateBudget(eventId, parseFloat(newBudget));
      setBudget(parseFloat(newBudget));
      setShowBudgetForm(false);
      toast.success('Budget updated');
    } catch (error) {
      toast.error('Failed to update budget');
    }
  };

  const deleteExpense = async (expenseId) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await expenseAPI.delete(eventId, expenseId);
      toast.success('Expense deleted');
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const budgetPercentage = budget > 0 ? (summary.total / budget) * 100 : 0;
  const isOverBudget = summary.total > budget && budget > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Budget Overview */}
      <div className="p-4 border-b border-neutral-100 bg-gradient-to-br from-neutral-50 to-white">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-neutral-900">Budget</h3>
          {isOrganizer && (
            <button
              onClick={() => setShowBudgetForm(!showBudgetForm)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Set Budget
            </button>
          )}
        </div>

        {showBudgetForm && isOrganizer && (
          <form onSubmit={handleBudgetUpdate} className="mb-3">
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="Budget amount"
                className="input input-sm flex-1"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
              />
              <button type="submit" className="btn btn-sm btn-primary">Set</button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-neutral-600">Spent</span>
            <span className={`text-2xl font-bold ${isOverBudget ? 'text-red-600' : 'text-neutral-900'}`}>
              {formatCurrency(summary.total)}
            </span>
          </div>
          
          {budget > 0 && (
            <>
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-neutral-600">Budget</span>
                <span className="text-lg text-neutral-700">{formatCurrency(budget)}</span>
              </div>

              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    isOverBudget ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                />
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">{budgetPercentage.toFixed(0)}% used</span>
                <span className={isOverBudget ? 'text-red-600 font-medium' : 'text-emerald-600'}>
                  {isOverBudget ? 'Over budget' : formatCurrency(summary.remaining)} left
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category Breakdown */}
      {Object.keys(summary.byCategory).length > 0 && (
        <div className="p-4 border-b border-neutral-100 bg-neutral-50">
          <h4 className="text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            By Category
          </h4>
          <div className="space-y-1">
            {Object.entries(summary.byCategory).map(([category, amount]) => (
              <div key={category} className="flex justify-between text-sm">
                <span className="text-neutral-600">{category}</span>
                <span className="font-medium text-neutral-900">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
        <h3 className="font-semibold text-neutral-900">Expenses ({summary.count})</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-sm btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="p-4 border-b border-neutral-100 bg-neutral-50">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              required
              placeholder="Expense title"
              className="input input-sm"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="Amount"
                className="input input-sm"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
              <input
                type="text"
                placeholder="Category"
                className="input input-sm"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <input
              type="text"
              placeholder="Paid by (optional)"
              className="input input-sm"
              value={formData.paidBy}
              onChange={(e) => setFormData({ ...formData, paidBy: e.target.value })}
            />
            <textarea
              placeholder="Notes (optional)"
              className="input input-sm resize-none"
              rows="2"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
            <div className="flex gap-2">
              <button type="submit" className="btn btn-sm btn-primary">Add Expense</button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {expenses.length === 0 ? (
          <div className="text-center text-neutral-400 py-12">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No expenses yet</p>
            <p className="text-sm mt-1">Track event costs here</p>
          </div>
        ) : (
          expenses.map(expense => (
            <div
              key={expense.id}
              className="p-3 rounded-lg border border-neutral-200 bg-white hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-neutral-900">{expense.title}</h4>
                    <span className="font-bold text-neutral-900">{formatCurrency(expense.amount)}</span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
                    {expense.category && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                        {expense.category}
                      </span>
                    )}
                    {expense.paidBy && (
                      <span className="text-neutral-500">Paid by {expense.paidBy}</span>
                    )}
                    <span className="text-neutral-400">
                      {new Date(expense.date).toLocaleDateString()}
                    </span>
                  </div>

                  {expense.notes && (
                    <p className="text-sm text-neutral-500 mt-2">{expense.notes}</p>
                  )}
                </div>

                <button
                  onClick={() => deleteExpense(expense.id)}
                  className="flex-shrink-0 text-neutral-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
