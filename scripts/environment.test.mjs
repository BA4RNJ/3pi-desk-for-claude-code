import test from 'node:test'
import assert from 'node:assert/strict'
import { isWslEnvironment } from '../src/shared/environment.ts'

test('detects WSL from the distro environment marker', () => {
  assert.equal(isWslEnvironment({ WSL_DISTRO_NAME: 'Ubuntu-24.04' }, ''), true)
})

test('detects WSL from the interop environment marker', () => {
  assert.equal(isWslEnvironment({ WSL_INTEROP: '/run/WSL/1_interop' }, ''), true)
})

test('detects WSL from the Microsoft kernel release', () => {
  assert.equal(
    isWslEnvironment({}, '5.15.153.1-microsoft-standard-WSL2'),
    true
  )
})

test('does not treat a native Linux kernel as WSL', () => {
  assert.equal(
    isWslEnvironment({}, '6.8.0-38-generic #38-Ubuntu SMP x86_64 GNU/Linux'),
    false
  )
})

test('does not treat Windows environment markers on native Linux as WSL', () => {
  assert.equal(isWslEnvironment({}, ''), false)
})
