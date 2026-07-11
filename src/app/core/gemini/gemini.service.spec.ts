import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { GeminiService } from './gemini.service';
import { GeminiBlockedError } from './gemini-blocked.error';

const { getGenerativeModelMock, generateContentStreamMock } = vi.hoisted(() => ({
  getGenerativeModelMock: vi.fn(),
  generateContentStreamMock: vi.fn(),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = getGenerativeModelMock;
  },
}));

// テキストを1チャンクのstream+responseに包んで返すヘルパ
function okStream(text: string) {
  return {
    stream: (async function* () {
      yield { text: () => text };
    })(),
    response: Promise.resolve({ promptFeedback: undefined }),
  };
}

function taggedResponse(overrides: Record<string, string> = {}): string {
  const grammarNotesJa = overrides['grammarNotesJa'] ?? 'ja1';
  return [
    `<grammar-notes-ja>${grammarNotesJa}</grammar-notes-ja>`,
    `<grammar-notes-en>en1</grammar-notes-en>`,
    `<corrected-text>Fixed text.</corrected-text>`,
    `<mistakes>{"mistakes":[{"category":"文法","original":"a","corrected":"b","explanation":"e"}]}</mistakes>`,
  ].join('\n');
}

describe('GeminiService', () => {
  let service: GeminiService;

  beforeEach(() => {
    generateContentStreamMock.mockReset();
    getGenerativeModelMock.mockReset().mockReturnValue({ generateContentStream: generateContentStreamMock });
    TestBed.configureTestingModule({ providers: [GeminiService] });
    service = TestBed.inject(GeminiService);
  });

  it('先頭モデルが成功した場合はフォールバックせず、成功モデル名をmodelに設定する', async () => {
    generateContentStreamMock.mockResolvedValue(okStream(taggedResponse()));
    const result = await service.correct('key', ['model-a', 'model-b'], '{USER_TEXT}', 'hi');
    expect(result.model).toBe('model-a');
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(1);
  });

  it('先頭モデルが失敗したら次のモデルへフォールバックする', async () => {
    generateContentStreamMock
      .mockRejectedValueOnce(new Error('quota exceeded'))
      .mockResolvedValueOnce(okStream(taggedResponse()));
    const result = await service.correct('key', ['model-a', 'model-b'], '{USER_TEXT}', 'hi');
    expect(result.model).toBe('model-b');
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(2);
  });

  it('全モデル失敗時は最後のエラーを投げる', async () => {
    generateContentStreamMock
      .mockRejectedValueOnce(new Error('err-a'))
      .mockRejectedValueOnce(new Error('err-b'));
    await expect(service.correct('key', ['model-a', 'model-b'], '{USER_TEXT}', 'hi')).rejects.toThrow('err-b');
  });

  it('GeminiBlockedErrorはフォールバックせず即座に投げる（残りモデルを試さない）', async () => {
    generateContentStreamMock.mockResolvedValue({
      stream: (async function* () {
        throw new Error('blocked stream');
      })(),
      response: Promise.reject({ response: { promptFeedback: { blockReason: 'SAFETY' } } }),
    });
    await expect(service.correct('key', ['model-a', 'model-b'], '{USER_TEXT}', 'hi')).rejects.toBeInstanceOf(
      GeminiBlockedError
    );
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(1);
  });

  it('response成功後のpromptFeedback.blockReasonでもGeminiBlockedErrorになる', async () => {
    generateContentStreamMock.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => '' };
      })(),
      response: Promise.resolve({ promptFeedback: { blockReason: 'SAFETY' } }),
    });
    await expect(
      service.correct('key', ['model-a'], '{USER_TEXT}', 'hi')
    ).rejects.toBeInstanceOf(GeminiBlockedError);
  });

  it('blockReasonが無ければstream中のエラーがそのまま再送出される', async () => {
    generateContentStreamMock.mockResolvedValue({
      stream: (async function* () {
        throw new Error('transient stream error');
      })(),
      response: Promise.resolve({ promptFeedback: undefined }),
    });
    await expect(service.correct('key', ['model-a'], '{USER_TEXT}', 'hi')).rejects.toThrow('transient stream error');
  });

  it('解説項目の一部タグが欠けても他のフィールド抽出には影響しない', async () => {
    generateContentStreamMock.mockResolvedValue(
      okStream(
        [
          `<corrected-text>Fixed text.</corrected-text>`,
          `<mistakes>{"mistakes":[]}</mistakes>`,
          // grammar-notes-ja/en は意図的に欠落させる
        ].join('\n')
      )
    );
    const result = await service.correct('key', ['model-a'], '{USER_TEXT}', 'hi');
    expect(result.grammarNotes).toBeUndefined();
    expect(result.correctedText).toBe('Fixed text.');
    expect(result.mistakes).toEqual([]);
  });
});
