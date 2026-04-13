import { TextStyle } from 'react-native';
import { appTheme } from './tokens';

export const chartTheme = {
    axisColor: appTheme.colors.borderStrong,
    rulesColor: '#edf1ff',
    axisText: {
        color: appTheme.colors.textMuted,
        fontSize: 10,
    } as TextStyle,
    lineThickness: 2.5,
    lineHeight: 130,
    sections: 4,
    spacingInset: 10,
} as const;
