import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'dart:math';

/// Portfolio Chart Widget
/// 
/// Dynamic line chart for portfolio growth visualization
class PortfolioChart extends StatelessWidget {
  final List<dynamic> dataPoints;
  final String period;
  final Function(String) onPeriodChanged;

  const PortfolioChart({
    super.key,
    required this.dataPoints,
    required this.period,
    required this.onPeriodChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withValues(alpha: 0.1),
            spreadRadius: 1,
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Portfolio Growth',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              _buildPeriodSelector(),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 200,
            child: dataPoints.isEmpty
                ? const Center(child: Text('No data available'))
                : LineChart(_buildChartData()),
          ),
          const SizedBox(height: 16),
          _buildLegend(),
        ],
      ),
    );
  }

  Widget _buildPeriodSelector() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          _buildPeriodButton('Monthly', 'monthly'),
          _buildPeriodButton('Yearly', 'yearly'),
        ],
      ),
    );
  }

  Widget _buildPeriodButton(String label, String value) {
    final isSelected = period == value;
    return GestureDetector(
      onTap: () => onPeriodChanged(value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF4338CA) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.grey[700],
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            fontSize: 12,
          ),
        ),
      ),
    );
  }

  LineChartData _buildChartData() {
    final spots = <FlSpot>[];
    
    for (int i = 0; i < dataPoints.length; i++) {
      final point = dataPoints[i];
      final profit = (point['cumulativeProfit'] ?? 0).toDouble();
      spots.add(FlSpot(i.toDouble(), profit));
    }

    // Calculate Y-axis range with better scaling
    double minY = 0;
    double maxY = 100; // Default minimum range
    
    if (spots.isNotEmpty) {
      final yValues = spots.map((s) => s.y).toList();
      final dataMin = yValues.reduce((a, b) => a < b ? a : b);
      final dataMax = yValues.reduce((a, b) => a > b ? a : b);
      
      // Add padding to min/max
      final range = dataMax - dataMin;
      final padding = range > 0 ? range * 0.2 : 50; // 20% padding or ₹50 minimum
      
      minY = dataMin - padding;
      maxY = dataMax + padding;
      
      // Ensure minimum range for visibility
      if (maxY - minY < 100) {
        final center = (maxY + minY) / 2;
        minY = center - 50;
        maxY = center + 50;
      }
      
      // Round to nice numbers
      minY = (minY / 10).floorToDouble() * 10;
      maxY = (maxY / 10).ceilToDouble() * 10;
    }

    // Calculate interval for Y-axis labels (aim for ~5 labels)
    final yRange = maxY - minY;
    double yInterval = yRange / 5;
    
    // Round interval to nice number
    if (yInterval > 0) {
      final magnitude = (log(yInterval.abs()) / ln10).floor(); // log10
      final power = pow(10.0, magnitude).toDouble();
      yInterval = (yInterval / power).ceilToDouble() * power;
    } else {
      yInterval = 20;
    }

    return LineChartData(
      gridData: FlGridData(
        show: true,
        drawVerticalLine: true,
        horizontalInterval: yInterval,
        verticalInterval: 1,
        getDrawingHorizontalLine: (value) {
          return FlLine(
            color: Colors.grey[200]!,
            strokeWidth: 1,
          );
        },
        getDrawingVerticalLine: (value) {
          return FlLine(
            color: Colors.grey[100]!,
            strokeWidth: 1,
          );
        },
      ),
      titlesData: FlTitlesData(
        show: true,
        rightTitles: const AxisTitles(
          sideTitles: SideTitles(showTitles: false),
        ),
        topTitles: const AxisTitles(
          sideTitles: SideTitles(showTitles: false),
        ),
        bottomTitles: AxisTitles(
          axisNameWidget: const Text(
            'Time Period',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
          ),
          axisNameSize: 20,
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 30,
            interval: dataPoints.length > 6 ? 2 : 1, // Show fewer labels if many points
            getTitlesWidget: (value, meta) {
              if (value.toInt() >= 0 && value.toInt() < dataPoints.length) {
                final label = dataPoints[value.toInt()]['label'] ?? '';
                final parts = label.split(' ');
                return Padding(
                  padding: const EdgeInsets.only(top: 8.0),
                  child: Text(
                    parts.isNotEmpty ? parts[0] : '',
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                );
              }
              return const Text('');
            },
          ),
        ),
        leftTitles: AxisTitles(
          axisNameWidget: const Text(
            'Profit/Loss (₹)',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
          ),
          axisNameSize: 50,
          sideTitles: SideTitles(
            showTitles: true,
            reservedSize: 50,
            interval: yInterval,
            getTitlesWidget: (value, meta) {
              // Format large numbers with K suffix
              String formattedValue;
              if (value.abs() >= 1000) {
                formattedValue = '₹${(value / 1000).toStringAsFixed(1)}K';
              } else {
                formattedValue = '₹${value.toStringAsFixed(0)}';
              }
              
              return Text(
                formattedValue,
                style: TextStyle(
                  color: value >= 0 ? Colors.green[700] : Colors.red[700],
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              );
            },
          ),
        ),
      ),
      borderData: FlBorderData(
        show: true,
        border: Border(
          left: BorderSide(color: Colors.grey[300]!, width: 1),
          bottom: BorderSide(color: Colors.grey[300]!, width: 1),
        ),
      ),
      minX: 0,
      maxX: (dataPoints.length - 1).toDouble(),
      minY: minY,
      maxY: maxY,
      lineBarsData: [
        LineChartBarData(
          spots: spots,
          isCurved: true,
          curveSmoothness: 0.3,
          color: const Color(0xFF312E81),
          barWidth: 3,
          isStrokeCapRound: true,
          dotData: FlDotData(
            show: true,
            getDotPainter: (spot, percent, barData, index) {
              final isProfit = spot.y >= 0;
              return FlDotCirclePainter(
                radius: 5,
                color: Colors.white,
                strokeWidth: 2,
                strokeColor: isProfit ? Colors.green : Colors.red,
              );
            },
          ),
          belowBarData: BarAreaData(
            show: true,
            gradient: LinearGradient(
              colors: [
                const Color(0xFF312E81).withValues(alpha: 0.2),
                const Color(0xFF312E81).withValues(alpha: 0.05),
              ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
        ),
      ],
      lineTouchData: LineTouchData(
        enabled: true,
        touchTooltipData: LineTouchTooltipData(
          getTooltipColor: (touchedSpot) => Colors.black87,
          getTooltipItems: (touchedSpots) {
            return touchedSpots.map((spot) {
              final dataPoint = dataPoints[spot.x.toInt()];
              final profit = spot.y;
              return LineTooltipItem(
                '${dataPoint['label']}\n',
                const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
                children: [
                  TextSpan(
                    text: 'Profit: ₹${profit.toStringAsFixed(2)}',
                    style: TextStyle(
                      color: profit >= 0 ? Colors.green[300] : Colors.red[300],
                      fontSize: 11,
                    ),
                  ),
                ],
              );
            }).toList();
          },
        ),
      ),
    );
  }

  Widget _buildLegend() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: const BoxDecoration(
            color: Color(0xFF312E81),
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          'Cumulative Profit/Loss',
          style: TextStyle(
            fontSize: 12,
            color: Colors.grey[600],
          ),
        ),
      ],
    );
  }
}
