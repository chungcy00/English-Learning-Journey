/** Headword spelling only. Sentence text and persistent vocabulary keys keep their own casing. */
const requiredCapitals = new Map<string, string>();
const properWords = [
  'I', 'English', 'Chinese', 'French', 'German', 'Spanish', 'Italian', 'Japanese', 'Korean',
  'Arabic', 'Malay', 'Tamil', 'Hindi', 'Portuguese', 'Russian', 'Thai', 'Vietnamese',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'Christmas', 'Easter', 'Halloween', 'Thanksgiving', 'Ramadan', 'Islam', 'Christianity', 'Buddhism',
  'London', 'Paris', 'Tokyo', 'Beijing', 'Shanghai', 'Singapore', 'Malaysia', 'China', 'Japan',
  'Korea', 'India', 'Indonesia', 'Thailand', 'Vietnam', 'Australia', 'Canada', 'America',
  'Europe', 'Asia', 'Africa', 'Antarctica', 'American', 'British', 'Australian', 'Canadian',
  'John', 'Sarah', 'Mary', 'Michael', 'David', 'Elizabeth', 'William', 'James', 'Robert',
  'Google', 'Microsoft', 'Apple', 'Amazon', 'YouTube', 'GitHub', 'OpenAI', 'ChatGPT', 'Gemini',
  'iPhone', 'iPad', 'MacBook', 'Wi-Fi', 'Bluetooth', 'Internet',
  'USA', 'UK', 'EU', 'UN', 'NASA', 'NATO', 'BBC', 'CNN', 'FBI', 'CIA', 'WHO',
  'AI', 'API', 'HTML', 'CSS', 'HTTP', 'HTTPS', 'URL', 'USB', 'PDF', 'CPU', 'DNA', 'RNA', 'GPS', 'TV', 'IT',
];
for (const word of properWords) requiredCapitals.set(word.toLowerCase(), word);

export function vocabularyHeadword(term: string, partOfSpeech = ''): string {
  const value = term.replace(/’/g, "'").replace(/\s+/g, ' ').trim();
  const proper = /proper\s*(?:noun|name)|专有名词|\bprop\.?\s*n\.?/i.test(partOfSpeech);
  if (proper) return value.replace(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g, word => requiredCapitals.get(word.toLowerCase()) ?? (/^[a-z]+$|^[A-Z]+$/.test(word) ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word));
  return value.replace(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g, word => {
    // These spellings distinguish common words from names or abbreviations.
    if (['US', 'May', 'Polish'].includes(word)) return word;
    if (['us', 'may', 'polish', 'apple', 'amazon', 'internet', 'it', 'who'].includes(word.toLowerCase())) return word.toLowerCase();
    return requiredCapitals.get(word.toLowerCase()) ?? word.toLowerCase();
  });
}
