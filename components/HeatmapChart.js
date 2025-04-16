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

const HeatmapChart = ({ title, data, labels, colorGradient }) => {
  // 색상 그라데이션 설정 (파란색 또는 초록색)
  const getGradient = () => {
    if (colorGradient === 'green') {
      return [
        'rgba(16, 185, 129, 0.05)',
        'rgba(16, 185, 129, 0.2)',
        'rgba(16, 185, 129, 0.4)',
        'rgba(16, 185, 129, 0.6)',
        'rgba(16, 185, 129, 0.8)',
        'rgba(16, 185, 129, 1)'
      ];
    }
    
    return [
      'rgba(59, 130, 246, 0.05)',
      'rgba(59, 130, 246, 0.2)',
      'rgba(59, 130, 246, 0.4)',
      'rgba(59, 130, 246, 0.6)',
      'rgba(59, 130, 246, 0.8)',
      'rgba(59, 130, 246, 1)'
    ];
  };

  // 차트 데이터 구성
  const chartData = {
    labels,
    datasets: [
      {
        label: '제출 횟수',
        data,
        backgroundColor: function(context) {
          const value = context.dataset.data[context.dataIndex];
          
          // 데이터의 최소값과 최대값 계산
          const max = Math.max(...context.dataset.data);
          const colorScale = max > 0 ? value / max : 0;
          
          const gradient = getGradient();
          
          // 색상 스케일 선택
          if (colorScale === 0) return gradient[0];
          else if (colorScale < 0.2) return gradient[1];
          else if (colorScale < 0.4) return gradient[2];
          else if (colorScale < 0.6) return gradient[3];
          else if (colorScale < 0.8) return gradient[4];
          else return gradient[5];
        },
        borderWidth: 1,
        borderColor: 'rgba(30, 41, 59, 0.1)',
        borderRadius: 3,
      }
    ]
  };
  
  // 차트 옵션
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 5,
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: 'rgba(203, 213, 225, 0.8)',
          // 라벨 수가 많을 경우 자동으로 폰트 크기 조정
          font: function(context) {
            const autoFontSize = Math.min(12, 20 - labels.length / 2);
            return {
              size: Math.max(8, autoFontSize),
              weight: '500'
            }
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          display: false,
        },
        ticks: {
          display: false
        },
        border: {
          display: false
        }
      }
    },
    plugins: {
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
            return `${context.formattedValue}회 제출`;
          }
        }
      },
      legend: {
        display: false
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
          bottom: 10
        }
      }
    }
  };
  
  return (
    <div className="card h-[230px]">
      <h3 className="text-base font-medium text-gray-300 mb-2">{title}</h3>
      <div className="w-full h-[180px]">
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default HeatmapChart; 