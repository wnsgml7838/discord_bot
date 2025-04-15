import React from 'react';

const AlertCard = ({ title, items, type = 'info' }) => {
  const typeClasses = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    danger: 'bg-red-50 border-red-200 text-red-800',
  };

  const typeClass = typeClasses[type] || typeClasses.info;

  return (
    <div className={`rounded-lg shadow p-4 border ${typeClass}`}>
      <h3 className="font-semibold text-sm mb-2">{title}</h3>
      {items.length > 0 ? (
        <ul className="text-sm space-y-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-center">
              <span className="mr-2">•</span>
              {typeof item === 'string' ? item : item.text}
              {item.caption && <span className="ml-1 opacity-70 text-xs">{item.caption}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm italic opacity-70">데이터 없음</p>
      )}
    </div>
  );
};

export default AlertCard; 