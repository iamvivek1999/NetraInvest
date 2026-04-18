import 'package:flutter/material.dart';

class HealthProfileScreen extends StatelessWidget {
  const HealthProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0b1326),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0b1326),
        elevation: 0,
        title: const Text('Health Profile', style: TextStyle(color: Color(0xFFdae2fd))),
        iconTheme: const IconThemeData(color: Color(0xFFdae2fd)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'NeuralNode',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: Color(0xFFdae2fd),
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Decentralized neural processing units for the next generation of autonomous AI agents.',
              style: TextStyle(fontSize: 15, color: Color(0xFFb7c8e1)),
            ),
            const SizedBox(height: 24),
            _buildMetricsGrid(),
            const SizedBox(height: 24),
            _buildHealthIndex(context),
            const SizedBox(height: 24),
            _buildRecentIntel(),
            const SizedBox(height: 24),
            _buildRiskFactors(),
            const SizedBox(height: 24),
            _buildFinancialHealth(),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricsGrid() {
    return Row(
      children: [
        Expanded(child: _buildMetricCard('TVL Growth', '+14%', Icons.trending_up, Colors.green)),
        const SizedBox(width: 12),
        Expanded(child: _buildMetricCard('Node Uptime', '99.9%', Icons.speed, Colors.blue)),
        const SizedBox(width: 12),
        Expanded(child: _buildMetricCard('Sentiment', 'Bullish', Icons.favorite, Colors.pink)),
      ],
    );
  }

  Widget _buildMetricCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF131b2e),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF171f33)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFFdae2fd),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF86948a),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildHealthIndex(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Health Index Visualization',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFFdae2fd),
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Multidimensional analysis of NeuralNode\'s operational and financial metrics.',
          style: TextStyle(fontSize: 13, color: Color(0xFF86948a)),
        ),
        const SizedBox(height: 16),
        Container(
          height: 200,
          width: double.infinity,
          decoration: BoxDecoration(
            color: const Color(0xFF131b2e),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF171f33)),
          ),
          child: Center(
            child: Stack(
              alignment: Alignment.center,
              children: [
                Icon(Icons.radar, size: 120, color: const Color(0xFF4edea3).withOpacity(0.2)),
                const Text(
                  'Score: 89/100',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF4edea3)),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRecentIntel() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Recent Intel',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFFdae2fd),
          ),
        ),
        const SizedBox(height: 16),
        _buildIntelItem(
          'Mainnet V2 Deployment Confirmed',
          'NeuralNode announces full activation of Layer 2 scaling solution, reducing node costs by 40%.',
        ),
        _buildIntelItem(
          'Strategic Alliance with Nvidia',
          'Integration of H100 GPU clusters into the NeuralNode network begins Q4.',
        ),
      ],
    );
  }

  Widget _buildIntelItem(String title, String desc) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF131b2e),
        borderRadius: BorderRadius.circular(12),
        border: const Border(left: BorderSide(color: Color(0xFF4edea3), width: 4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: Color(0xFFdae2fd),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            desc,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFFb7c8e1),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRiskFactors() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Risk Factors',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFFdae2fd),
          ),
        ),
        const SizedBox(height: 16),
        _buildRiskItem('Hardware Dependency', 'High initial operational costs due to global GPU supply constraints.', Colors.orange),
        _buildRiskItem('Regulatory Scrutiny', 'Possible changes to decentralized entity classifications in the EU.', Colors.yellow),
      ],
    );
  }

  Widget _buildRiskItem(String label, String desc, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF131b2e),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF171f33)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.warning_amber_rounded, color: color, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFdae2fd),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  desc,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF86948a),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFinancialHealth() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Financial Health Ledger',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFFdae2fd),
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Real-time verification of on-chain treasury and burn rate.',
          style: TextStyle(fontSize: 13, color: Color(0xFF86948a)),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF131b2e),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF171f33)),
          ),
          child: Column(
            children: [
              _buildLedgerRow('Treasury Balance', '₹1.8M', isHighlight: true),
              const Divider(color: Color(0xFF171f33), height: 24),
              _buildLedgerRow('Monthly Burn (Avg)', '₹120k'),
              const Divider(color: Color(0xFF171f33), height: 24),
              _buildLedgerRow('Runway Estimated', '15 Months'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLedgerRow(String label, String value, {bool isHighlight = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 14, color: Color(0xFFb7c8e1)),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: isHighlight ? const Color(0xFF4edea3) : const Color(0xFFdae2fd),
          ),
        ),
      ],
    );
  }
}
