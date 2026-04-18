import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class StartupCampaignPitchScreen extends StatelessWidget {
  final Map<String, dynamic> campaign;
  static final _currency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  const StartupCampaignPitchScreen({super.key, required this.campaign});

  @override
  Widget build(BuildContext context) {
    final title = campaign['title'] as String? ?? 'Untitled Project';
    final description = campaign['description'] as String? ?? 'Details about the project.';
    final goal = (campaign['fundingGoal'] as num?)?.toDouble() ?? 0;
    final raised = (campaign['currentRaised'] as num?)?.toDouble() ?? 0;
    final progress = goal > 0 ? (raised / goal).clamp(0.0, 1.0) : 0.0;
    final investorsCount = (campaign['investorsCount'] as num?)?.toInt() ?? 0;

    return Scaffold(
      backgroundColor: const Color(0xFF0b1326),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0b1326).withValues(alpha: 0.6),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF4edea3)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('Pitch Deck', style: TextStyle(color: Color(0xFF4edea3), fontWeight: FontWeight.bold, fontSize: 16)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 120),
        child: Column(
          children: [
            // Hero
            Container(
              height: 380,
              width: double.infinity,
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF131b2e),
                borderRadius: BorderRadius.circular(24),
                boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 20)],
              ),
              child: Stack(
                children: [
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [const Color(0xFF0b1326), const Color(0xFF0b1326).withValues(alpha: 0.2), Colors.transparent],
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                          ),
                        ),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFF4edea3).withValues(alpha: 0.1),
                            border: Border.all(color: const Color(0xFF4edea3).withValues(alpha: 0.2)),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.circle, color: Color(0xFF4edea3), size: 8),
                              SizedBox(width: 6),
                              Text('LIVE CAMPAIGN', style: TextStyle(color: Color(0xFF4edea3), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(title, style: const TextStyle(color: Color(0xFFdae2fd), fontSize: 36, fontWeight: FontWeight.w900, height: 1.1)),
                        const SizedBox(height: 8),
                        Text(description, style: const TextStyle(color: Color(0xFFb7c8e1), fontSize: 14, height: 1.4)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Stats
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: const Color(0xFF131b2e).withValues(alpha: 0.7),
                        border: Border.all(color: const Color(0xFF3c4a42).withValues(alpha: 0.1)),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('GOAL', style: TextStyle(color: Color(0xFF86948a), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                          const SizedBox(height: 4),
                          Text(_currency.format(goal), style: const TextStyle(color: Color(0xFFdae2fd), fontSize: 24, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: progress,
                              minHeight: 4,
                              backgroundColor: const Color(0xFF2d3449),
                              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF4edea3)),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text('${(progress * 100).toStringAsFixed(1)}% Funded', style: const TextStyle(color: Color(0xFF4edea3), fontSize: 10, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: const Color(0xFF131b2e).withValues(alpha: 0.7),
                        border: Border.all(color: const Color(0xFF3c4a42).withValues(alpha: 0.1)),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('INVESTORS', style: TextStyle(color: Color(0xFF86948a), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                          const SizedBox(height: 4),
                          Text('$investorsCount', style: const TextStyle(color: Color(0xFFdae2fd), fontSize: 24, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 12),
                          // Avatar stack mockup
                          SizedBox(
                            height: 24,
                            child: Row(
                              children: [
                                const CircleAvatar(radius: 12, backgroundColor: Colors.white, child: Icon(Icons.person, size: 16, color: Colors.black)),
                                Transform.translate(offset: const Offset(-8, 0), child: const CircleAvatar(radius: 12, backgroundColor: Colors.grey, child: Icon(Icons.person, size: 16, color: Colors.white))),
                                Transform.translate(offset: const Offset(-16, 0), child: CircleAvatar(radius: 12, backgroundColor: const Color(0xFF3a4a5f), child: Center(child: Text('+${investorsCount > 2 ? investorsCount - 2 : 0}', style: const TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Colors.white))))),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Milestones
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Milestone Roadmap', style: TextStyle(color: Color(0xFFdae2fd), fontSize: 24, fontWeight: FontWeight.w800)),
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Container(
                decoration: const BoxDecoration(
                  border: Border(left: BorderSide(color: Color(0x3386948a))),
                ),
                padding: const EdgeInsets.only(left: 24),
                child: Column(
                  children: [
                    _buildMilestone(
                      title: 'Alpha Engine Launch',
                      desc: 'Successfully deployed core protocol on Layer 2.',
                      time: 'COMPLETED — Q1 2024',
                      isCompleted: true,
                      isCurrent: false,
                    ),
                    const SizedBox(height: 32),
                    _buildMilestone(
                      title: 'Global Edge Expansion',
                      desc: 'Scaling node architecture across 12 strategic geographic zones.',
                      time: 'IN PROGRESS — Q3 2024',
                      isCompleted: false,
                      isCurrent: true,
                    ),
                    const SizedBox(height: 32),
                    _buildMilestone(
                      title: 'DAO Governance',
                      desc: 'Transitioning control to token holders for protocol upgrades.',
                      time: 'PLANNED — Q1 2025',
                      isCompleted: false,
                      isCurrent: false,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),

            // Donut Chart Mock
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFF131b2e).withValues(alpha: 0.7),
                  border: Border.all(color: const Color(0xFF3c4a42).withValues(alpha: 0.1)),
                  borderRadius: BorderRadius.circular(32),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Usage Breakdown', style: TextStyle(color: Color(0xFFdae2fd), fontSize: 20, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        // Pseudo pie chart
                        Container(
                          width: 120,
                          height: 120,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFF4edea3), width: 8),
                          ),
                          child: const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text('100%', style: TextStyle(color: Color(0xFFdae2fd), fontSize: 24, fontWeight: FontWeight.w900)),
                                Text('TOTAL', style: TextStyle(color: Color(0xFFb7c8e1), fontSize: 10, fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 32),
                        // Legend
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _LegendItem(color: Color(0xFF4edea3), title: 'R&D', subtitle: '40% Capital'),
                              SizedBox(height: 12),
                              _LegendItem(color: Color(0xFF10b981), title: 'Marketing', subtitle: '30% Capital'),
                              SizedBox(height: 12),
                              _LegendItem(color: Color(0xFFb7c8e1), title: 'Operations', subtitle: '20% Capital'),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),
            // Document Vault
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Document Vault', style: TextStyle(color: Color(0xFFdae2fd), fontSize: 24, fontWeight: FontWeight.w800)),
                  Text('View All', style: TextStyle(color: Color(0xFF4edea3), fontSize: 12, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                children: [
                  _buildVaultCard('Project Whitepaper v2.1', 'PDF • 4.2 MB • FEB 2024'),
                  const SizedBox(height: 12),
                  _buildVaultCard('Legal Framework & Audit', 'PDF • 1.8 MB • JAN 2024'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMilestone({required String title, required String desc, required String time, required bool isCompleted, required bool isCurrent}) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned(
          left: -33,
          top: 0,
          child: Container(
            width: 16,
            height: 16,
            decoration: BoxDecoration(
              color: isCompleted ? const Color(0xFF4edea3) : (isCurrent ? const Color(0xFF10b981) : const Color(0xFF2d3449)),
              shape: BoxShape.circle,
              border: isCurrent ? Border.all(color: const Color(0xFF4edea3), width: 2) : (isCompleted ? null : Border.all(color: const Color(0xFF86948a))),
              boxShadow: isCompleted ? [const BoxShadow(color: Color(0x334edea3), blurRadius: 8, spreadRadius: 4)] : null,
            ),
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(title, style: TextStyle(color: isCompleted || isCurrent ? const Color(0xFFdae2fd) : const Color(0xFFdae2fd).withOpacity(0.5), fontSize: 18, fontWeight: FontWeight.bold))),
                if (isCompleted)
                  Container(
                    margin: const EdgeInsets.only(left: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4edea3).withOpacity(0.1),
                      border: Border.all(color: const Color(0xFF4edea3).withOpacity(0.2)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.circle, color: Color(0xFF4edea3), size: 4),
                        SizedBox(width: 4),
                        Text('VERIFIED ON CHAIN', style: TextStyle(color: Color(0xFF4edea3), fontSize: 9, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(desc, style: TextStyle(color: isCompleted || isCurrent ? const Color(0xFFb7c8e1) : const Color(0xFFb7c8e1).withOpacity(0.5), fontSize: 14)),
            const SizedBox(height: 4),
            Text(time, style: TextStyle(color: isCompleted ? const Color(0xFF86948a) : (isCurrent ? const Color(0xFF4edea3) : const Color(0xFF86948a)), fontSize: 10, fontWeight: FontWeight.bold)),
          ],
        ),
      ],
    );
  }

  Widget _buildVaultCard(String title, String subtitle) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF131b2e).withValues(alpha: 0.7),
        border: Border.all(color: const Color(0xFF3c4a42).withValues(alpha: 0.1)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFF2d3449),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.description, color: Color(0xFF4edea3), size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Color(0xFFdae2fd), fontSize: 14, fontWeight: FontWeight.bold)),
                Text(subtitle, style: const TextStyle(color: Color(0xFF86948a), fontSize: 10, fontWeight: FontWeight.w500)),
              ],
            ),
          ),
          const Icon(Icons.download, color: Color(0xFFb7c8e1)),
        ],
      ),
    );
  }
}

class _LegendItem extends StatelessWidget {
  final Color color;
  final String title;
  final String subtitle;

  const _LegendItem({required this.color, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(color: Color(0xFFdae2fd), fontSize: 12, fontWeight: FontWeight.bold)),
            Text(subtitle, style: const TextStyle(color: Color(0xFFb7c8e1), fontSize: 10)),
          ],
        ),
      ],
    );
  }
}
