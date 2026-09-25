const { draftCompletionText, parseDraftModelJson } = require('../estimateDraftFromNotes');

describe('draftCompletionText', () => {
  it('reads string content', () => {
    expect(
      draftCompletionText({
        choices: [{ message: { content: ' {"projectType":"new_build"} ' } }],
      })
    ).toBe('{"projectType":"new_build"}');
  });

  it('reads text parts when content is an array', () => {
    expect(
      draftCompletionText({
        choices: [
          {
            message: {
              content: [{ type: 'text', text: '{"projectType":"other"}' }],
            },
          },
        ],
      })
    ).toBe('{"projectType":"other"}');
  });

  it('parses a fenced JSON object', () => {
    expect(parseDraftModelJson('```json\n{"projectType":"new_build"}\n```')).toEqual({
      projectType: 'new_build',
    });
  });

  it('parses JSON when the model adds text around the object', () => {
    expect(
      parseDraftModelJson('Here is the draft:\n{"projectType":"other"}\nDone.')
    ).toEqual({ projectType: 'other' });
  });

  it('returns an empty string when the model message is blank', () => {
    expect(draftCompletionText({ choices: [{ message: { content: '' } }] })).toBe('');
    expect(draftCompletionText({})).toBe('');
  });
});
