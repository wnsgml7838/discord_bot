import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const LineChart = ({ 
  title, 
  datasets, 
  labels, 
  yAxisLabel, 
  suggestedMax, 
  tooltipLabel,
  tooltipSuffix
}) => {
  // 차트 색상 (최대 5개 사용자 고려)
  const colorPalette = [
    { main: 'rgba(59, 130, 246, 1)', background: 'rgba(59, 130, 246, 0.2)' }, // 파랑
    { main: 'rgba(16, 185, 129, 1)', background: 'rgba(16, 185, 129, 0.2)' }, // 초록
    { main: 'rgba(245, 158, 11, 1)', background: 'rgba(245, 158, 11, 0.2)' }, // 노랑
    { main: 'rgba(236, 72, 153, 1)', background: 'rgba(236, 72, 153, 0.2)' }, // 핑크
    { main: 'rgba(139, 92, 246, 1)', background: 'rgba(139, 92, 246, 0.2)' }, // 보라
  ];
  
  // 차트 데이터 구성
  const chartData = {
    labels,
    datasets: datasets.map((dataset, index) => {
      const colorSet = colorPalette[index % colorPalette.length];
      return {
        label: dataset.label,
        data: dataset.data,
        fill: true,
        backgroundColor: dataset.backgroundColor || colorSet.background,
        borderColor: dataset.borderColor || colorSet.main,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: dataset.borderColor || colorSet.main,
        pointBorderColor: 'rgba(30, 41, 59, 1)',
        pointBorderWidth: 1.5,
      };
    })
  };
  
  // 차트 옵션
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
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
        title: {
          display: yAxisLabel ? true : false,
          text: yAxisLabel || '',
        },
        suggestedMax: suggestedMax,
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(203, 213, 225, 0.8)',
          precision: 0,
          callback: function(value) {
            return yAxisLabel ? `${value}${yAxisLabel}` : value;
          }
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
            const label = tooltipLabel || context.dataset.label || '';
            return `${label}: ${context.formattedValue}${tooltipSuffix || ''}`;
          }
        }
      },
      title: {
        display: title ? true : false,
        text: title,
        color: 'rgba(255, 255, 255, 0.8)',
        font: {
          size: 14,
          weight: '500'
        },
        padding: 20,
      },
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          boxWidth: 6
        }
      },
    },
  };
  
  return (
    <div className="card h-[230px]">
      <div className="w-full h-[230px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

export default LineChart; 