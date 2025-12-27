import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { theme, style = 'verse-chorus', language = 'en', mood = 'happy' } = body;

    // Check if Mureka API is configured
    const murekaApiKey = process.env.MUREKA_API_KEY;
    const murekaApiUrl = process.env.MUREKA_API_URL;

    if (murekaApiKey && murekaApiUrl) {
      try {
        // Build prompt from theme and mood
        const prompt = `Write ${style} lyrics about ${theme || 'life'}. Mood: ${mood || 'uplifting'}. Language: ${language || 'English'}.`;

        const response = await fetch(`${murekaApiUrl}/v1/lyrics/generate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${murekaApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            lyrics: data.lyrics,
            title: data.title,
          });
        }

        console.error('Mureka lyrics API failed:', response.status, await response.text());
      } catch (error) {
        console.error('Mureka lyrics API error:', error);
        // Fall through to mock
      }
    }

    // Mock lyrics generation
    const lyrics = generateMockLyrics(theme, style, mood);
    return NextResponse.json({ lyrics });

  } catch (error) {
    console.error('Lyrics generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate lyrics' },
      { status: 500 }
    );
  }
}

function generateMockLyrics(theme?: string, style?: string, mood?: string): string {
  const themeWord = theme || 'love';

  const templates: Record<string, string> = {
    'verse-chorus': `[Verse 1]
In the ${mood === 'dark' ? 'shadows' : 'light'} of ${themeWord}
I find my way through the night
Every step I take leads me closer
To where the ${mood === 'happy' ? 'stars shine bright' : 'echoes fade'}

[Chorus]
${themeWord.charAt(0).toUpperCase() + themeWord.slice(1)}, you're all I need
Like a ${mood === 'energetic' ? 'fire burning' : 'gentle breeze'}
Take my hand and we'll be free
This is where we're meant to be

[Verse 2]
Through the highs and through the lows
Wherever life may lead us
I'll be there ${mood === 'sad' ? 'in memories' : 'beside you'}
${themeWord.charAt(0).toUpperCase() + themeWord.slice(1)} is what I'll always give

[Chorus]
${themeWord.charAt(0).toUpperCase() + themeWord.slice(1)}, you're all I need
Like a ${mood === 'energetic' ? 'fire burning' : 'gentle breeze'}
Take my hand and we'll be free
This is where we're meant to be

[Bridge]
When the world feels cold
And the story's yet untold
We'll write our own destiny
You and me, eternally

[Outro]
${themeWord.charAt(0).toUpperCase() + themeWord.slice(1)}, ${themeWord}
Forever ${themeWord}...`,

    'freeform': `${themeWord.charAt(0).toUpperCase() + themeWord.slice(1)} flows through me
Like rivers to the sea
In every breath I take
In every choice I make

${mood === 'sad' ? 'Fading like the sunset' : 'Rising like the dawn'}
${themeWord.charAt(0).toUpperCase() + themeWord.slice(1)} carries on
Through time and space
In this sacred place

I am one with ${themeWord}
I am free, I am whole
${themeWord.charAt(0).toUpperCase() + themeWord.slice(1)} is my soul`,

    'rap': `[Verse]
Yeah, let me tell you 'bout ${themeWord}
${mood === 'energetic' ? 'Got the fire in my soul, never giving up' : 'Moving through the days, finding my way up'}
Every single day I'm grinding for the dream
${themeWord.charAt(0).toUpperCase() + themeWord.slice(1)} runs through my veins, you know what I mean

[Hook]
${themeWord.toUpperCase()}, that's the game
Never gonna be the same
${themeWord.toUpperCase()}, make it rain
Break the chains, feel no pain

[Verse 2]
From the bottom to the top, watch me rise
${themeWord.charAt(0).toUpperCase() + themeWord.slice(1)} in my eyes, no disguise
Real recognize real, that's the deal
${mood === 'aggressive' ? 'Coming at you hard' : 'Keeping it smooth'}, this is how I feel`,

    'spoken-word': `${themeWord.charAt(0).toUpperCase() + themeWord.slice(1)}...

A word that carries the weight of a thousand stories
In the ${mood === 'peaceful' ? 'stillness of dawn' : 'chaos of the night'}
We find ourselves searching

Searching for ${themeWord}
In the eyes of strangers
In the echo of our own heartbeat
In the silence between words

And when we finally find it
${themeWord.charAt(0).toUpperCase() + themeWord.slice(1)} transforms us
Makes us whole
Makes us human

This is ${themeWord}
This is life
This is now`,
  };

  return templates[style || 'verse-chorus'];
}
