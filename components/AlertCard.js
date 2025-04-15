import React from 'react';

const AlertCard = ({ title, items, type = 'info' }) => {
  const typeClasses = {
    info: {
      card: 'border-blue-500/20 bg-blue-500/5',
      title: 'text-blue-400',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      )
    },
    success: {
      card: 'border-green-500/20 bg-green-500/5',
      title: 'text-green-400',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    },
    warning: {
      card: 'border-amber-500/20 bg-amber-500/5',
      title: 'text-amber-400',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
    },
    danger: {
      card: 'border-red-500/20 bg-red-500/5',
      title: 'text-red-400',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      )
    },
  };

  const typeClass = typeClasses[type] || typeClasses.info;

  return (
    <div className={`card border ${typeClass.card}`}>
      <div className="flex items-center space-x-2 mb-3">
        {typeClass.icon}
        <h3 className={`text-base font-medium ${typeClass.title}`}>{title}</h3>
      </div>
      
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-center text-gray-300 hover:text-white transition-colors">
              <div className="mr-3 h-2 w-2 rounded-full bg-gray-500"></div>
              <div>
                <span className="text-sm">{typeof item === 'string' ? item : item.text}</span>
                {item.caption && (
                  <span className="ml-1 text-xs text-gray-400">{item.caption}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm italic text-gray-500">데이터 없음</p>
      )}
    </div>
  );
};

export default AlertCard; 