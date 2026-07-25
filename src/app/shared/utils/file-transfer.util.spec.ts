import { vi } from 'vitest';
import { downloadJson, readTextFile } from './file-transfer.util';

describe('downloadJson', () => {
  it('anchor に download 名を設定してクリックし、ObjectURL を解放する', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadJson('out.json', '{"a":1}');

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake');

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});

describe('readTextFile', () => {
  function eventWith(files: File[] | null): { event: Event; input: HTMLInputElement } {
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    return { event: { target: input } as unknown as Event, input };
  }

  it('選択ファイルの中身をテキストとして渡し、input を空にする', async () => {
    const { event, input } = eventWith([new File(['{"a":1}'], 'in.json')]);
    input.value = '';
    const onText = vi.fn();

    readTextFile(event, onText);
    await vi.waitFor(() => expect(onText).toHaveBeenCalledWith('{"a":1}'));
    expect(input.value).toBe('');
  });

  it('ファイル未選択（キャンセル）なら何もしない', () => {
    const { event } = eventWith([]);
    const onText = vi.fn();

    readTextFile(event, onText);
    expect(onText).not.toHaveBeenCalled();
  });

  it('files が null でも例外を投げない', () => {
    const { event } = eventWith(null);
    expect(() => readTextFile(event, vi.fn())).not.toThrow();
  });
});
