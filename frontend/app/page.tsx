import React from 'react';
import { DollarSign, PieChart, CreditCard, ArrowUpRight } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-emerald-50 text-emerald-900">
      <nav className="p-6 flex justify-between items-center max-w-6xl mx-auto">
        <div className="font-bold text-2xl flex items-center gap-2">
          <div className="bg-emerald-600 text-white p-1 rounded">BW</div> BudgetWise
        </div>
        <button className="text-sm font-semibold hover:text-emerald-600">Login</button>
      </nav>

      <div className="max-w-4xl mx-auto mt-12 px-6 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-5xl font-bold leading-tight mb-6 text-emerald-950">
            Money made <span className="text-emerald-600">simple.</span>
          </h1>
          <p className="text-lg text-emerald-800/60 mb-8">
            Stop wondering where your money went. Our AI categorizes expenses and predicts your savings automatically.
          </p>
          <div className="flex gap-4">
             <button className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition">
              Get Started Free
            </button>
          </div>
        </div>

        {/* Floating Card UI */}
        <div className="relative">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-300 rounded-full blur-3xl opacity-20"></div>
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-emerald-100 relative z-10 rotate-2 hover:rotate-0 transition duration-500">
            <div className="flex justify-between items-center mb-8">
              <span className="text-sm text-gray-400">Total Balance</span>
              <PieChart size={20} className="text-emerald-500" />
            </div>
            <div className="text-4xl font-bold mb-2">2,450.00</div>
            <div className="flex items-center gap-1 text-sm text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded">
              <ArrowUpRight size={14} /> +12% this month
            </div>
            
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-orange-100 p-2 rounded-full"><DollarSign size={16} className="text-orange-600"/></div>
                  <div className="text-sm font-semibold">Grocery</div>
                </div>
                <span className="font-bold text-red-500">-4.00</span>
              </div>
               <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full"><CreditCard size={16} className="text-blue-600"/></div>
                  <div className="text-sm font-semibold">Salary</div>
                </div>
                <span className="font-bold text-emerald-600">+,200.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
