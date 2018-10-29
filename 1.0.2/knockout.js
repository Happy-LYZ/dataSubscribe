/****************************************************************
 * 		 knockoutjs的实现
 * 		 @by bluemind
 *****************************************************************/

var ko = window.ko = {};
ko.observable = function (initialValue) {
	var _latestValue = initialValue;

	function observable(newValue) {
		if (arguments.length > 0) {
			// set 方法
			_latestValue = newValue;
			observable.notifySubscribers(_latestValue);
		} else {
			// get 方法
			ko.dependencyDetection.registerDependency(observable);
		}
		return _latestValue;
	}
	observable.valueHasMutated = function () { observable.notifySubscribers(_latestValue); }
	// 继承ko.subscribable的方法
	ko.subscribable.call(observable);
	return observable;
}

ko.subscribable = function () {
	var _subscriptions = [];

	this.subscribe = function (callback) {
		_subscriptions.push(callback);
	};

	this.notifySubscribers = function (valueToNotify) {
		for(var i = 0; i < _subscriptions.length;i++) {
			_subscriptions[i](valueToNotify);
		}
	};
}

// 计算属性
ko.dependentObservable = function(evaluatorFunction, evaluatorFunctionTarget) {
	var _lastValue,_isFirstEvaluation = true;
	function evaluate() {
		_isFirstEvaluation && ko.dependencyDetection.begin();
		_lastValue = evaluatorFunctionTarget ? evaluatorFunction.call(evaluatorFunctionTarget) : evaluatorFunction();
		_isFirstEvaluation && replaceSubscriptionsToDependencies(ko.dependencyDetection.end());
		
		dependentObservable.notifySubscribers(_lastValue);
		_isFirstEvaluation = false;
	}
	
	function replaceSubscriptionsToDependencies(dependencies) {
		dependencies.forEach(function(dependence) {
			dependence.subscribe(evaluate);
		});
	}
	
	function dependentObservable() {
		ko.dependencyDetection.registerDependency(dependentObservable);
		return _lastValue;
	}
	ko.subscribable.call(dependentObservable);
	evaluate();
	
	return dependentObservable;
}

// 依赖收集的收集暂存箱
ko.dependencyDetection = (function () {
    var _detectedDependencies = [];

    return {
        begin: function () {
            _detectedDependencies.push([]);
        },

        end: function () {
            return _detectedDependencies.pop();
        },

        registerDependency: function (subscribable) {
            if (_detectedDependencies.length > 0) {
                _detectedDependencies[_detectedDependencies.length - 1].push(subscribable);
            }
        }
    };
})();

// 可监控数组
ko.observableArray = function(initialValues) {
	var result = new ko.observable(initialValues);
	["pop", "push", "reverse", "shift", "sort", "splice", "unshift"].forEach(function(methodName) {
		result[methodName] = function() {
			var underlyingArray = result();
			var methodCallResult = underlyingArray[methodName].apply(underlyingArray, arguments);
			result.valueHasMutated();
            return methodCallResult;
		}
	});
	['slice'].forEach(function(methodName) {
		result[methodName] = function() {
			var underlyingArray = result();
            return underlyingArray[methodName].apply(underlyingArray, arguments);
		}
	});
	return result;
}

/** 绑定 **/
var bindingAttributeName = "data-bind";
ko.bindingHandlers = {};

ko.bindingHandlers.text = {
	update: function (element, value) {
		element.innerText = value();
	}
};

ko.bindingHandlers.value = {
	init: function(element, value) {
		element.addEventListener("change", function () { value(this.value); }, false);
	},
	update: function (element, value) {
		element.value = value();
	}
};

ko.bindingHandlers.options = {
	update: function (element, value) {
		var value = value();
		element.innerHTML = "";
		for(var i = 0;i < value.length;i++) {
			var option = document.createElement("OPTION");
			option.value = value[i];
			option.innerHTML = value[i];
			element.appendChild(option);
		}
	}
};

// 绑定的入口
ko.applyBindingsToNode = function (viewModel, node) {
	var isFirstEvaluation = true;
	new ko.dependentObservable(function () {
			var parsedBindings = parseBindingAttribute(node.getAttribute(bindingAttributeName), viewModel);
			for (var bindingKey in parsedBindings) {
				if (ko.bindingHandlers[bindingKey]) {
					if (isFirstEvaluation && typeof ko.bindingHandlers[bindingKey].init == "function") {
						ko.bindingHandlers[bindingKey].init(node, parsedBindings[bindingKey]);
					}
					if (typeof ko.bindingHandlers[bindingKey].update == "function") {
						ko.bindingHandlers[bindingKey].update(node, parsedBindings[bindingKey]);
					}
				}
			}
		}, null);
	
	isFirstEvaluation = false;
};

// 解析html
function parseBindingAttribute(attributeText, viewModel) {
	var bindings = {}, tmp = attributeText.split(',');
	for(var i = 0;i < tmp.length;i++) {
		var names = tmp[0].split(':'), handlerName = names[0], observableName = names[1];
		bindings[handlerName] = viewModel[observableName];
	}
	return bindings;
}