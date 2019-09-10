let util = require('../../lib/utilities');

describe('Utilities', function() {
    beforeEach(() => {});

    afterEach(() => {});

    it('get route path parts from a simple route definition', function() {
        let path = util.getRoutePathParts('getUsers');
        let test = [{ type: 'resource', value: 'getUsers' }];
        expect(path).toEqual(test);
    });

    it('get route path parts from a complex route definition', function() {
        let path = util.getRoutePathParts('admin/getUsers/:id');
        let test = [
            { type: 'resource', value: 'admin' },
            { type: 'resource', value: 'getUsers' },
            { type: 'param', value: 'id' }
        ];

        expect(path).toEqual(test);
    });
});