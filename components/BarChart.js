import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const BarChart = ({ title, data, labels, colorGradient = 'blue' }) => {
  // 색상 그라데이션 설정
  const getColorGradient = (value, max) => {
    const ratio = value / (max || 1);
    
    if (colorGradient === 'blue') {
      return `rgba(59, 130, 246, ${0.3 + ratio * 0.7})`;
    } else if (colorGradient === 'green') {
      return `rgba(16, 185, 129, ${0.3 + ratio * 0.7})`;
    } else if (colorGradient === 'purple') {
      return `rgba(139, 92, 246, ${0.3 + ratio * 0.7})`;
    } else if (colorGradient === 'orange') {
      return `rgba(249, 115, 22, ${0.3 + ratio * 0.7})`;
    } else if (colorGradient === 'red') {
      return `rgba(239, 68, 68, ${0.3 + ratio * 0.7})`;
    } else {
      // 기본 블루 그라데이션
      return `rgba(59, 130, 246, ${0.3 + ratio * 0.7})`;
    }
  };
  
  // 최대값 찾기
  const maxValue = Math.max(...data);
  
  // 차트 데이터 구성
  const chartData = {
    labels,
    datasets: [
      {
        label: title,
        data,
        backgroundColor: data.map(value => getColorGradient(value, maxValue)),
        borderColor: 'rgba(30, 41, 59, 0.8)',
        borderWidth: 1,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 40,
      }
    ]
  };
  
  // 차트 옵션
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: title,
        color: 'rgba(255, 255, 255, 0.8)',
        font: {
          size: 14,
          weight: '500'
        },
        padding: {
          bottom: 15
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: 'rgba(255, 255, 255, 0.9)',
        bodyColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        padding: 10,
        boxPadding: 5,
        usePointStyle: true,
        callbacks: {
          label: function(context) {
            return `${context.formattedValue}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(203, 213, 225, 0.8)',
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(203, 213, 225, 0.8)',
          precision: 0
        }
      }
    }
  };
  
  return (
    <div className="card bg-slate-800 rounded-xl p-4 shadow-lg h-[280px]">
      <h3 className="text-base font-medium text-gray-100 mb-2">{title}</h3>
      <div className="h-[230px]">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default BarChart; 