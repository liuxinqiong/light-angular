Provider.service('taskService', function () {
    return {
        getData: function () {
            return [{ name: 'work' }, { name: 'cookie' }, { name: 'sleep' }, { name: 'wash' }];
        }
    }
})

Provider.controller('taskCtrl', function (taskService) {
    console.log(taskService.getData());
})

var ctrl = Provider.get('taskCtrl' + Provider.CONTROLLERS_SUFFIX);
Provider.invoke(ctrl);

Provider.controller('MainCtrl', function ($scope) {
    $scope.bar = 0;
    $scope.foo = function () {
        $scope.bar += 1;
    };
    $scope.person = { age: 20 }
    $scope.addAge = function () {
        $scope.person.age += 1;
    };
});

DOMCompiler.bootstrap();