export abstract class Component {
	protected element: HTMLElement | null;

	constructor(elem?: string) {
		if (elem) {
			this.element = document.querySelector(`#${elem}`)!;
		} else {
			this.element = null;
		}
	}

	abstract render(): string;

	mount(...args: any[]) {
		if (this.element) {
			this.element.innerHTML = this.render();
		}
		this.afterRender(args);
	}

	setElement(elem: HTMLElement): void {
		this.element = elem;
	}

	getElement(): HTMLElement | null {
		return this.element;
	}

	afterRender(...args: any[]) { }
}

export function mountComponent<T extends Component>(component: new (name: string) => T,
	mountPoint: string, ...args: any[]): void {
	const instance = new component(mountPoint);
	instance.mount(args);
}
