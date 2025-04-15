import React from 'react';

const StatCard = ({ title, value, caption, icon, color = 'blue', trend = null }) => {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/5 text-blue-500',
    green: 'from-green-500/20 to-green-600/5 text-green-500',
    amber: 'from-amber-500/20 to-amber-600/5 text-amber-500',
    purple: 'from-purple-500/20 to-purple-600/5 text-purple-500',
    indigo: 'from-indigo-500/20 to-indigo-600/5 text-indigo-500',
  };

  const gradientClass = colorClasses[color] || colorClasses.blue;
  
  // 추세 표시 (증가, 감소, 유지)
  const renderTrend = () => {
    if (!trend) return null;
    
    const { type, value } = trend;
    const isPositive = type === 'increase';
    const isNeutral = type === 'neutral';
    
    const trendClasses = isPositive 
      ? 'text-green-500' 
      : isNeutral 
        ? 'text-gray-400' 
        : 'text-red-500';
        
    const trendIcon = isPositive 
      ? '↑' 
      : isNeutral 
        ? '→' 
        : '↓';
        
    return (
      <div className={`text-xs font-medium flex items-center ${trendClasses}`}>
        <span className="mr-1">{trendIcon}</span>
        <span>{value}%</span>
        <span className="ml-1 text-gray-400">from yesterday</span>
      </div>
    );
  };

  return (
    <div className={`card border border-dark-700 bg-gradient-to-br ${gradientClass}`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-gray-400">{title}</h3>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {caption && <p className="text-xs mt-1 text-gray-400">{caption}</p>}
          {renderTrend()}
        </div>
        {icon && (
          <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-dark-700/80">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard; 