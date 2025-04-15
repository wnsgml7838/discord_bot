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
  Legend
} from 'chart.js';

// Chart.js 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const LineChart = ({ title, datasets, labels }) => {
  // 차트 색상 (최대 5개 사용자 고려)
  const colors = [
    'rgba(255, 99, 132, 0.8)',   // 빨강
    'rgba(54, 162, 235, 0.8)',   // 파랑
    'rgba(255, 206, 86, 0.8)',   // 노랑
    'rgba(75, 192, 192, 0.8)',   // 청녹
    'rgba(153, 102, 255, 0.8)',  // 보라
  ];
  
  // 차트 데이터 구성
  const chartData = {
    labels,
    datasets: datasets.map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      backgroundColor: colors[index % colors.length],
      borderColor: colors[index % colors.length],
      tension: 0.2,
      pointRadius: 3,
      pointHoverRadius: 6
    }))
  };
  
  // 차트 옵션
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
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
            return `${context.dataset.label}: ${context.formattedValue}회 제출`;
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
      <Line data={chartData} options={options} />
    </div>
  );
};

export default LineChart; 