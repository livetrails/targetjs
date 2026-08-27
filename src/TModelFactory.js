class TModelFactory {
    static factories = [];

    static register(match, create) {
        TModelFactory.factories.push({ match, create });
    }

    static create(type, targets, defaultCreator, ...args) {
        for (const entry of this.factories) {
            if (entry.match(targets)) {
                return entry.create(type, targets, ...args);
            }
        }

        return defaultCreator(type, targets, ...args);
    }
}

export { TModelFactory };