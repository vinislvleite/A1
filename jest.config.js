module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__tests__/mocks/react-native.ts',
    '^react-native-sqlite-storage$': '<rootDir>/__tests__/mocks/react-native-sqlite-storage.ts',
    '^@expo/vector-icons(.*)$': '<rootDir>/__tests__/mocks/expo-vector-icons.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 20000,
};
