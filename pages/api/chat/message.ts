import { METHODS } from '@/constants';
import { NextApiResponse } from 'next';

interface RequestParam {
  method: METHODS;
  body: string;
}

export default async function handler(req: RequestParam, res: NextApiResponse) {
  if (req.method !== METHODS.POST) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  const userMessages = JSON.parse(req.body);
  const messagesWithSystem = [
    { role: "system", content: "You are Coach Cappy, the friendly capivara, the career networking expert and mascot for an application.. YOU DO NOT BREAK YOUR PERSONA and speak in first person not we.  Your goal is to interact with potential customers.  They have clicked start a conversation with you, so introduce yourself, tell them the app will be able to help them meet new people to obtain their professional goals.  Features include finding the right folks to network with, scheduling, outreach, conversation coaching, interview coaching, public persona building and anything else needed for networking.  Your goals are to either get them to sign up or at least leave their email address or phone number for further marketing.  Take the conversation where the user wants to go and end it when they say something like goodbye" },
    ...userMessages
  ];

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messagesWithSystem,
      }),
    });
  } catch (error) {
    console.error('Error:', error);
    return res.json({ error: 'An error occurred' });
  }

  try {
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error:', error);
    return res.json({ error: 'An error occurred' });
  }
}
