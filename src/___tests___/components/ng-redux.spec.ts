import 'reflect-metadata';
import 'es6-shim';
import { expect, use } from 'chai';
import { createStore } from 'redux';
import { NgRedux } from '../../components/ng-redux';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';

use(sinonChai);

function returnPojo() {
  return {};
}

describe('Connector', () => {
  let store;
  let connector;
  let targetObj;
  let defaultState;

  beforeEach(() => {
    defaultState = {
      foo: 'bar',
      baz: -1
    };
    store = createStore((state = defaultState, action) => {
      const newState = Object.assign({}, state, { baz: action.payload });
      return newState;
    });
    targetObj = {};
    connector = new NgRedux(store);
  });

  it('Should throw when target is not a Function or a plain object', () => {
    expect(connector.connect(returnPojo).bind(connector, 15))
      .to.throw(Error);
    expect(connector.connect(returnPojo).bind(connector, undefined))
      .to.throw(Error);
    expect(connector.connect(returnPojo).bind(connector, 'test'))
      .to.throw(Error);

    expect(connector.connect(returnPojo).bind(connector, {}))
      .not.to.throw(Error);
    expect(connector.connect(returnPojo).bind(connector, returnPojo))
      .not.to.throw(Error);

  });

  it('Should throw when selector does not return a plain object', () => {
    expect(connector.connect.bind(connector, state => state.foo))
      .to.throw(Error);
  });


  it('Should extend target (Object) with selected state once directly after ' +
    'creation', () => {
      connector.connect(
        () => ({
          vm: { test: 1 }
        }))(targetObj);

      expect(targetObj.vm).to.deep.equal({ test: 1 });
    });

  it('Should update the target (Object) passed to connect when the store ' +
    'updates', () => {
      connector.connect(state => state)(targetObj);
      store.dispatch({ type: 'ACTION', payload: 0 });
      expect(targetObj.baz).to.equal(0);
      store.dispatch({ type: 'ACTION', payload: 7 });
      expect(targetObj.baz).to.equal(7);
    });

  it('Should prevent unnecessary updates when state does not change ' +
    '(shallowly)', () => {
      connector.connect(state => state)(targetObj);
      store.dispatch({ type: 'ACTION', payload: 5 });

      expect(targetObj.baz).to.equal(5);

      targetObj.baz = 0;

      //this should not replace our mutation, since the state didn't change
      store.dispatch({ type: 'ACTION', payload: 5 });

      expect(targetObj.baz).to.equal(0);
    });

  it('Should extend target (object) with actionCreators', () => {
    connector.connect(returnPojo,
      { ac1: returnPojo, ac2: () => { } })(targetObj);
    expect(targetObj.ac1).to.be.a('Function');
    expect(targetObj.ac2).to.be.a('Function');
  });

  it('Should return an unsubscribing function', () => {
    const unsubscribe = connector.connect(state => state)(targetObj);
    store.dispatch({ type: 'ACTION', payload: 5 });

    expect(targetObj.baz).to.equal(5);

    unsubscribe();

    store.dispatch({ type: 'ACTION', payload: 7 });

    expect(targetObj.baz).to.equal(5);

  });

  it('Should provide dispatch to mapDispatchToTarget when receiving a ' +
    'Function', () => {
      let receivedDispatch;
      connector.connect(
        returnPojo, dispatch => { receivedDispatch = dispatch })(targetObj);
      expect(receivedDispatch).to.equal(store.dispatch);
    });

});


describe('NgRedux Observable Store', () => {
  interface IAppState {
    foo: string;
    bar: string;
    baz: number;

  };
  
  let store;
  let connector;
  let targetObj;
  let defaultState;

  beforeEach(() => {
    defaultState = {
      foo: 'bar',
      bar: 'foo',
      baz: -1,
    };

    store = createStore((state = defaultState, action) => {
      switch (action.type) {
        case 'UPDATE_FOO':
          return Object.assign({}, state, { foo: action.payload });
        case 'UPDATE_BAZ':
          return Object.assign({}, state, { baz: action.payload });
        case 'UPDATE_BAR':
          return Object.assign({}, state, { bar: action.payload });
        default:
          return state;
      }
    });


  })

  it('should get the initial state', (done) => {
    let ngRedux = new NgRedux<IAppState>(store);
    let state$ = ngRedux
      .select(state => state)
      .subscribe(state => {
        expect(state.foo).to.equal('bar');
        expect(state.baz).to.equal(-1);

        done();
      });
  });

  it('should accept a keyname for a selector', (done) => {
    let ngRedux = new NgRedux<IAppState>(store);
    let foo$ = ngRedux
      .select('foo')
      .subscribe(stateSlice => {
        expect(stateSlice).to.equal('bar');
        done();
      });
  });

  it('should not trigger a selector if that slice of state was not changed',
    (): void => {
      let ngRedux = new NgRedux<IAppState>(store);
      let fooData;

      let spy = sinon.spy((foo) => { fooData = foo; });


      let foo$ = ngRedux
        .select('foo')
        .subscribe(spy);

      ngRedux.dispatch({ type: 'UPDATE_BAR', payload: 0 });

      expect(spy).to.have.been.calledOnce;

      expect(fooData).to.equal('bar');
      ngRedux.dispatch({ type: 'UPDATE_FOO', payload: 'changeFoo' });
      expect(spy).to.have.been.calledTwice;
      expect(fooData).to.equal('changeFoo');
      foo$.unsubscribe();

    });

  it('should not trigger a selector if the action payload is the same',
    (): void => {
      let ngRedux = new NgRedux<IAppState>(store);
      let fooData;
      let spy = sinon.spy((foo) => { fooData = foo; });
      let foo$ = ngRedux
        .select('foo')
        .subscribe(spy);

      expect(spy).to.have.been.calledOnce;
      expect(fooData).to.equal('bar');

      ngRedux.dispatch({ type: 'UPDATE_FOO', payload: 'bar' });
      expect(spy).to.have.been.calledOnce;
      expect(fooData).to.equal('bar');
      foo$.unsubscribe();

    });

  it('should not call the sub if the result of the function is the same', () => {
    let ngRedux = new NgRedux<IAppState>(store);
    let fooData;
    let spy = sinon.spy((foo) => { fooData = foo; });
    let foo$ = ngRedux
      .select(state => `${state.foo}-${state.baz}`)
      .subscribe(spy);

    expect(spy).to.have.been.calledOnce;
    expect(fooData).to.equal('bar--1');

    ngRedux.dispatch({ type: 'UPDATE_BAR', payload: 'bar' });
    expect(spy).to.have.been.calledOnce;
    expect(fooData).to.equal('bar--1');

    ngRedux.dispatch({ type: 'UPDATE_FOO', payload: 'update' });
    expect(fooData).to.equal('update--1');
    expect(spy).to.have.been.calledTwice;

    ngRedux.dispatch({ type: 'UPDATE_BAZ', payload: 2 });
    expect(fooData).to.equal('update-2');
    expect(spy).to.have.been.calledThrice;

  });

  it(`should accept a custom compare function`, () => {
    let ngRedux = new NgRedux<IAppState>(store);
    let fooData;
    let spy = sinon.spy((foo) => { fooData = foo; });
    let cmp = (a, b) => a.data === b.data;

    let foo$ = ngRedux
      .select(state => ({ data: `${state.foo}-${state.baz}` }), cmp)
      .subscribe(spy);

    expect(spy).to.have.been.calledOnce;
    expect(fooData.data).to.equal('bar--1');

    ngRedux.dispatch({ type: 'UPDATE_BAR', payload: 'bar' });
    expect(spy).to.have.been.calledOnce;
    expect(fooData.data).to.equal('bar--1');

    ngRedux.dispatch({ type: 'UPDATE_FOO', payload: 'update' });
    expect(fooData.data).to.equal('update--1');
    expect(spy).to.have.been.calledTwice;

    ngRedux.dispatch({ type: 'UPDATE_BAZ', payload: 2 });
    expect(fooData.data).to.equal('update-2');
    expect(spy).to.have.been.calledThrice;

  });

});