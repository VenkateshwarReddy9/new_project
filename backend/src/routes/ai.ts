import { Router, Response } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const parseSplitSchema = z.object({
  prompt: z.string().min(1).max(500),
  totalAmount: z.number().positive(),
  members: z.array(z.object({ id: z.string(), name: z.string() })).min(2),
});

router.post('/parse-split', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { prompt, totalAmount, members } = parseSplitSchema.parse(req.body);

    const memberList = members.map((m) => `- ${m.name} (id: ${m.id})`).join('\n');

    const systemPrompt = `You are an expense splitting assistant. Given a description of how to split an expense, calculate how much each person should pay.

Group members:
${memberList}

Total expense: $${totalAmount.toFixed(2)}

Rules:
1. All split amounts MUST sum exactly to $${totalAmount.toFixed(2)}
2. Return a JSON object with ONLY this structure:
{
  "splits": [
    {"userId": "<exact id from members list>", "name": "<name>", "amount": <number>}
  ],
  "explanation": "<brief explanation of the split>"
}
3. Every member must appear in splits (even if their amount is 0)
4. Amounts should be rounded to 2 decimal places
5. Return ONLY the JSON, no other text`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `Split this expense: ${prompt}`,
        },
      ],
      system: systemPrompt,
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';

    let parsed: { splits: { userId: string; name: string; amount: number }[]; explanation: string };
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      res.status(500).json({ error: 'AI returned an invalid response. Please try rephrasing your request.' });
      return;
    }

    // Validate the result
    if (!parsed.splits || !Array.isArray(parsed.splits)) {
      res.status(500).json({ error: 'Invalid AI response format' });
      return;
    }

    // Ensure all member IDs are valid
    const validIds = new Set(members.map((m) => m.id));
    for (const split of parsed.splits) {
      if (!validIds.has(split.userId)) {
        res.status(500).json({ error: 'AI returned unknown member ID' });
        return;
      }
    }

    // Validate sum (with tolerance)
    const sum = parsed.splits.reduce((acc, s) => acc + s.amount, 0);
    if (Math.abs(sum - totalAmount) > 0.05) {
      // Try to adjust the last split to fix rounding
      const diff = totalAmount - sum;
      parsed.splits[parsed.splits.length - 1].amount = Math.round((parsed.splits[parsed.splits.length - 1].amount + diff) * 100) / 100;
    }

    res.json(parsed);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    console.error('AI parse-split error:', err);
    res.status(500).json({ error: 'AI split parsing failed. Please try again or use manual split.' });
  }
});

export default router;
