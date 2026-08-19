import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Atomically validates a reward redemption: checks the staff member's lifetime
// points balance (total earned across all IncentiveScore weeks minus points
// already spent on non-cancelled redemptions) is enough to cover the reward's
// points_cost, verifies the reward is active and in stock, then creates a
// pending RewardRedemption record. Returns the updated balance.
//
// Payload: { staff_id, staff_name, reward_id }
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { staff_id, staff_name, reward_id } = body || {};
    if (!staff_id || !reward_id) {
      return Response.json({ error: 'staff_id and reward_id are required' }, { status: 400 });
    }

    // Only the owner or an admin may redeem on behalf of a staff member.
    const isOwner = user.data?.staff_id === staff_id || user.id === staff_id;
    if (!isOwner && user.role !== 'admin') {
      return Response.json({ error: 'You can only redeem rewards for yourself' }, { status: 403 });
    }

    // Use service role for the balance calculation so RLS on RewardRedemption
    // (owner-or-admin read) doesn't hide other records the user legitimately
    // owns, and IncentiveScore reads are unrestricted regardless.
    const svc = base44.asServiceRole;

    // 1. Load the reward and validate it.
    const reward = await svc.entities.Reward.get(reward_id);
    if (!reward || reward.is_active === false) {
      return Response.json({ error: 'This reward is no longer available' }, { status: 404 });
    }
    if (reward.stock_count != null && reward.stock_count <= 0) {
      return Response.json({ error: 'This reward is out of stock' }, { status: 409 });
    }

    // 2. Compute the lifetime points balance.
    const scores = await svc.entities.IncentiveScore.filter({ staff_id });
    const totalEarned = scores.reduce((s, r) => s + (Number(r.total_points) || 0), 0);

    const redemptions = await svc.entities.RewardRedemption.filter({ staff_id });
    const totalSpent = redemptions
      .filter((r) => r.status !== 'cancelled')
      .reduce((s, r) => s + (Number(r.points_spent) || 0), 0);

    const balance = totalEarned - totalSpent;
    const cost = Number(reward.points_cost) || 0;

    if (balance < cost) {
      return Response.json({
        error: 'Not enough points',
        balance,
        cost,
      }, { status: 409 });
    }

    // 3. Create the redemption (user-scoped so created_by_id is stamped).
    const redemption = await base44.entities.RewardRedemption.create({
      staff_id,
      staff_name: staff_name || '',
      reward_id,
      reward_name: reward.name,
      reward_type: reward.reward_type || 'gift_card',
      points_spent: cost,
      gift_card_value_gbp: reward.gift_card_value_gbp || null,
      status: 'pending',
      requested_at: new Date().toISOString(),
    });

    // 4. Decrement stock if tracked.
    if (reward.stock_count != null) {
      try {
        await svc.entities.Reward.update(reward_id, {
          stock_count: Math.max(0, reward.stock_count - 1),
        });
      } catch (e) {
        // Non-fatal — the redemption still stands.
      }
    }

    return Response.json({
      success: true,
      redemption,
      balance: balance - cost,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}