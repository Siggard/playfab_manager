# TODO - PlayFab Bundle Editor

## Planned Features

### 1. Relationship Graph
Визуализация связей между сущностями:
- Граф показывает как entities связаны между собой
- Players → linked features (из полей def.feature, mid.feature, etc.)
- Locations → requirements (какие marks нужны для активации)
- Bundles → содержимое (все items внутри)
- Интерактивный: клик на ноду открывает EntityEditor
- Фильтры по типу связей

**Сложность**: Высокая (нужна библиотека для графов, например D3.js или vis.js)

### 2. Auto-hints (Автоподсказки)
Умные подсказки при заполнении CustomData:
- Анализ существующих entities того же ItemClass
- Подсказка доступных значений для полей (directions, marks, etc.)
- Автодополнение на основе уже введённых данных
- Валидация в реальном времени с подсказками что исправить

**Сложность**: Средняя

---

## Ideas Backlog

- Mass edit (выбрать несколько entities и изменить поле у всех)
- Diff view (сравнение двух версий каталога)
- Import from spreadsheet (CSV/Excel)
- Keyboard shortcuts for navigation
- Dark theme
