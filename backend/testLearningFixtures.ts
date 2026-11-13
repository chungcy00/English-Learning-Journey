export const DETAILS = {
  isValidTerm: true, term: 'conflict', type: 'word', category: 'word', phoneticUK: '/ˈkɒn.flɪkt/', phoneticUS: '/ˈkɑːn.flɪkt/',
  senses: [{ text: 'disagreement', meaningZh: '冲突', partOfSpeech: 'noun' }], inflections: [{ label: '复数', value: 'conflicts' }],
  sections: {
    examples: [{ text: 'They resolved the conflict.', meaningZh: '他们解决了冲突。' }], derivatives: [], roots: [],
    phrases: [{ text: 'a conflict of interest', meaningZh: '利益冲突', category: '常见搭配' }],
    definitions: [{ text: 'A serious disagreement.', meaningZh: '' }], usage: [{ text: 'conflict / disagreement', usageKind: 'comparison', meaningZh: '强烈冲突与普通分歧的区别。' }],
  },
};

export const STRUCTURED_DETAILS = {
  ...DETAILS,
  sections: { ...DETAILS.sections, usage: [{
    kind: 'comparison', comparison: {
      context: '描述意见不同', difference: 'conflict 强调尖锐冲突，disagreement 可表示普通分歧。',
      expressions: [
        {expression:'conflict',explanation:'冲突。强调矛盾较强。',examples:[{english:'There is a conflict of interest.',chinese:'存在利益冲突。'}]},
        {expression:'disagreement',explanation:'分歧。强调意见不同。',examples:[{english:'We had a disagreement.',chinese:'我们有过分歧。'}]},
      ],
    },
  }] },
};
