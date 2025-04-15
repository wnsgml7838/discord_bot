import React from 'react';

const StatCard = ({ title, value, caption, icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 border-blue-200',
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
  };

  const colorClass = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`rounded-lg shadow p-4 border ${colorClass}`}>
      <div className="flex justify-between">
        <div>
          <h3 className="text-sm font-medium opacity-80">{title}</h3>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {caption && <p className="text-xs mt-1 opacity-70">{caption}</p>}
        </div>
        {icon && (
          <div className="flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard; 