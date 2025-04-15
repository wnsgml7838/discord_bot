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

const HeatmapChart = ({ title, data, labels, colorGradient = 'blue' }) => {
  // 색상 그라데이션 설정
  const getColorGradient = (value, max) => {
    const ratio = value / (max || 1);
    let r, g, b;
    
    if (colorGradient === 'blue') {
      r = Math.floor(220 * (1 - ratio)); // 밝은 파랑에서 진한 파랑으로
      g = Math.floor(220 * (1 - ratio));
      b = 255;
    } else {
      // 기본 그린 그라데이션
      r = Math.floor(220 * (1 - ratio));
      g = 255;
      b = Math.floor(220 * (1 - ratio));
    }
    
    return `rgba(${r}, ${g}, ${b}, 0.8)`;
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
        borderColor: data.map(value => getColorGradient(value, maxValue)),
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };
  
  // 차트 옵션
  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 14
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.formattedValue}회 제출`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default HeatmapChart; 