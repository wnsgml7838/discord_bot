import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
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

// 그라데이션 색상 팔레트
const colorPalettes = {
  blue: ['#EBF5FF', '#90CDF4', '#3182CE', '#2B6CB0', '#2A4365'],
  green: ['#F0FFF4', '#9AE6B4', '#48BB78', '#2F855A', '#22543D'],
  purple: ['#FAF5FF', '#D6BCFA', '#9F7AEA', '#805AD5', '#553C9A'],
  amber: ['#FFFBEB', '#FCD34D', '#F59E0B', '#D97706', '#92400E'],
};

const HeatmapChart = ({ 
  title, 
  data, 
  labels, 
  colorGradient = 'blue',
  tooltipCallback,
  extraInfo
}) => {
  if (!data || !labels) {
    return <div className="text-center text-gray-500 py-8">데이터가 없습니다.</div>;
  }

  // 최대값을 기준으로 색상을 할당
  const maxValue = Math.max(...data, 1);
  
  // 색상 팔레트 선택
  const palette = colorPalettes[colorGradient] || colorPalettes.blue;
  
  // 데이터 값에 따라 색상 그라데이션 적용
  const backgroundColor = data.map(value => {
    const normalizedValue = value / maxValue;
    if (normalizedValue <= 0.2) return palette[0];
    if (normalizedValue <= 0.4) return palette[1];
    if (normalizedValue <= 0.6) return palette[2];
    if (normalizedValue <= 0.8) return palette[3];
    return palette[4];
  });

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: {
          top: 10,
          bottom: 20,
        },
      },
      tooltip: {
        callbacks: {
          label: tooltipCallback || function(context) {
            return `${context.formattedValue} 회`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          callback: function(value) {
            if (value === 0) return '0';
            if (Number.isInteger(value)) return value.toString();
            return '';
          }
        }
      },
      y: {
        grid: {
          display: false,
        },
      }
    },
  };

  const chartData = {
    labels,
    datasets: [
      {
        label: title,
        data,
        backgroundColor,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.8,
        categoryPercentage: 0.8,
      }
    ],
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div style={{ height: '250px' }}>
        <Bar options={options} data={chartData} />
      </div>
      {extraInfo && (
        <div className="mt-2 text-center text-sm text-gray-700 italic">
          {extraInfo}
        </div>
      )}
    </div>
  );
};

export default HeatmapChart; 