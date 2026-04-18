import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/startup_provider.dart';
import '../utils/formatters.dart';
import 'health_profile_screen.dart';

class StartupProfileScreen extends StatelessWidget {
  const StartupProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<StartupProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading && provider.profile == null) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.error != null && provider.profile == null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 12),
                Text(provider.error!, style: const TextStyle(color: Colors.redAccent)),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () => provider.fetchStartupData(),
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        final profile = provider.profile ?? {};
        final campaign = provider.activeCampaign ?? {};
        final milestones = provider.milestones;

        return RefreshIndicator(
          onRefresh: () => provider.fetchStartupData(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(context, profile),
                const SizedBox(height: 24),
                _buildMissionBrief(profile),
                const SizedBox(height: 24),
                _buildStatsGrid(campaign),
                const SizedBox(height: 24),
                _buildDevelopmentRoadmap(milestones),
                const SizedBox(height: 24),
                _buildExecutiveTeam(profile),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHeader(BuildContext context, Map<String, dynamic> profile) {
    final name = profile['startupName'] as String? ?? 'Your Startup';
    final sector = profile['industrySector'] as String? ?? 'Technology Sector';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                name,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFdae2fd),
                  letterSpacing: -0.5,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            IconButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (context) => const HealthProfileScreen()),
                );
              },
              icon: const Icon(Icons.health_and_safety_outlined, color: Color(0xFF4edea3)),
              tooltip: 'Health Profile',
            ),
          ],
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0x334edea3),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFF4edea3).withOpacity(0.4)),
          ),
          child: Text(
            sector,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Color(0xFF4edea3),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMissionBrief(Map<String, dynamic> profile) {
    final mission = profile['mission'] as String? ?? 
                   profile['description'] as String? ?? 
                   'No mission brief provided.';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Mission Brief',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFFdae2fd),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          mission,
          style: const TextStyle(
            fontSize: 15,
            color: Color(0xFFb7c8e1),
            height: 1.5,
          ),
        ),
      ],
    );
  }

  Widget _buildStatsGrid(Map<String, dynamic> campaign) {
    final raised = (campaign['currentRaised'] as num?)?.toDouble() ?? 0;
    final goal = (campaign['fundingGoal'] as num?)?.toDouble() ?? 0;
    final investorCount = (campaign['investorCount'] as num?)?.toInt() ?? 0;
    
    // Derived or hardcoded for now until backend provides
    final nodesActive = "N/A"; 
    final uptime = "Verified";

    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.5,
      children: [
        _StatCard(
          label: 'Raised', 
          value: formatINR(raised), 
          subtitle: goal > 0 ? 'Target ${formatINR(goal)}' : 'No Active Goal'
        ),
        _StatCard(label: 'Investors', value: investorCount.toString()),
        _StatCard(label: 'Verification', value: uptime, highlight: true),
        _StatCard(label: 'Growth Stage', value: 'Seed'),
      ],
    );
  }

  Widget _buildDevelopmentRoadmap(List<dynamic> milestones) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Development Roadmap',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFFdae2fd),
              ),
            ),
            if (milestones.isEmpty)
              const Text(
                'No Milestones',
                style: TextStyle(fontSize: 12, color: Color(0xFF86948a)),
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (milestones.isEmpty)
          const Text(
            'Your development roadmap is generated once milestones are added to an active campaign.',
            style: TextStyle(color: Color(0xFF86948a), fontSize: 13),
          )
        else
          ...milestones.asMap().entries.map((entry) {
            final idx = entry.key;
            final m = entry.value as Map<String, dynamic>;
            final status = m['status'] as String? ?? 'pending';
            
            return _buildRoadmapItem(
              title: m['title'] as String? ?? 'Milestone ${idx + 1}',
              description: m['description'] as String? ?? '',
              isCompleted: status == 'disbursed' || status == 'completed',
              isActive: status == 'approved' || status == 'submitted',
              isUpcoming: status == 'pending',
              isLast: idx == milestones.length - 1,
            );
          }),
      ],
    );
  }

  Widget _buildRoadmapItem({
    required String title,
    required String description,
    bool isCompleted = false,
    bool isActive = false,
    bool isUpcoming = false,
    bool isLast = false,
  }) {
    var iconColor = const Color(0xFF171f33);
    var lineColor = const Color(0xFF171f33);
    IconData icon = Icons.circle_outlined;

    if (isCompleted) {
      iconColor = const Color(0xFF4edea3);
      lineColor = const Color(0xFF4edea3);
      icon = Icons.check_circle_rounded;
    } else if (isActive) {
      iconColor = const Color(0xFFdae2fd);
      lineColor = const Color(0xFF171f33);
      icon = Icons.play_circle_fill_rounded;
    }

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.only(top: 2.0),
            child: Column(
              children: [
                Icon(icon, color: iconColor, size: 22),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: lineColor,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: isCompleted || isActive ? const Color(0xFFdae2fd) : const Color(0xFF86948a),
                    ),
                  ),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF86948a),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExecutiveTeam(Map<String, dynamic> profile) {
    final team = profile['executiveTeam'] as List<dynamic>? ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Executive Team',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFFdae2fd),
          ),
        ),
        const SizedBox(height: 16),
        if (team.isEmpty)
          const Text(
            'Team details are coming soon.',
            style: TextStyle(color: Color(0xFF86948a), fontSize: 13),
          )
        else
          ...team.map((member) {
            final m = member as Map<String, dynamic>;
            final name = m['name'] as String? ?? 'Team Member';
            final role = m['role'] as String? ?? 'Executive';
            final background = m['bio'] as String? ?? m['experience'] as String? ?? 'Verified Professional';
            
            // Generate initials
            final nameParts = name.trim().split(' ');
            final initials = nameParts.length > 1 
                ? '${nameParts[0][0]}${nameParts[1][0]}'.toUpperCase()
                : nameParts[0].isNotEmpty ? nameParts[0][0].toUpperCase() : '?';

            return _buildTeamMember(
              initials: initials,
              name: name,
              role: role,
              background: background,
            );
          }),
      ],
    );
  }

  Widget _buildTeamMember({
    required String initials,
    required String name,
    required String role,
    required String background,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF131b2e),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF171f33)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            backgroundColor: const Color(0xFF171f33),
            child: Text(
              initials,
              style: const TextStyle(color: Color(0xFF4edea3), fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFdae2fd),
                  ),
                ),
                Text(
                  role,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF4edea3),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  background,
                  style: const TextStyle(
                    fontSize: 13,
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
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final String? subtitle;
  final bool highlight;

  const _StatCard({
    required this.label,
    required this.value,
    this.subtitle,
    this.highlight = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF131b2e),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: highlight ? const Color(0xFF4edea3).withValues(alpha: 0.5) : const Color(0xFF171f33)),
        boxShadow: highlight
            ? [BoxShadow(color: const Color(0xFF4edea3).withValues(alpha: 0.1), blurRadius: 10, spreadRadius: 1)]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF86948a),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: highlight ? const Color(0xFF4edea3) : const Color(0xFFdae2fd),
              ),
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle!,
              style: const TextStyle(
                fontSize: 11,
                color: Color(0xFF67748e),
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}
